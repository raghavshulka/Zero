import React, { useState, useEffect } from 'react';
import { ZeroEntropy } from 'zeroentropy';

interface DocumentState {
  apiKey: string;
  client: ZeroEntropy | null;
  files: File[];
  documents: any[];
  selectedDocument: any;
  message: string;
  loading: boolean;
  searchQuery: string;
  sortOrder: 'asc' | 'desc';
  filterStatus: string;
}

const DocumentManager: React.FC = () => {
  const [state, setState] = useState<DocumentState>({
    apiKey: '',
    client: null,
    files: [],
    documents: [],
    selectedDocument: null,
    message: '',
    loading: false,
    searchQuery: '',
    sortOrder: 'desc',
    filterStatus: 'all'
  });

  useEffect(() => {
    if (state.client) {
      loadDocuments();
    }
  }, [state.client, state.searchQuery, state.sortOrder, state.filterStatus]);

  const handleAuthenticate = async () => {
    try {
      const client = new ZeroEntropy({ apiKey: state.apiKey });
      setState(prev => ({
        ...prev,
        client,
        message: 'Authentication successful!'
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        message: 'Authentication failed. Please check your API key.'
      }));
      console.error('Authentication error:', error);
    }
  };

  const loadDocuments = async () => {
    if (!state.client) return;

    setState(prev => ({ ...prev, loading: true }));
    try {
      const response = await state.client.documents.getInfoList({
        collection_name: 'default',
        limit: 1000
      });

      let filteredDocs = response.documents;

      // Apply search filter
      if (state.searchQuery) {
        filteredDocs = filteredDocs.filter(doc => 
          doc.path.toLowerCase().includes(state.searchQuery.toLowerCase())
        );
      }

      // Apply status filter
      if (state.filterStatus !== 'all') {
        filteredDocs = filteredDocs.filter(doc => 
          doc.index_status === state.filterStatus
        );
      }

      // Apply sorting
      filteredDocs.sort((a, b) => {
        const comparison = a.path.localeCompare(b.path);
        return state.sortOrder === 'asc' ? comparison : -comparison;
      });

      setState(prev => ({
        ...prev,
        documents: filteredDocs,
        loading: false
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        message: 'Failed to load documents',
        loading: false
      }));
      console.error('Loading error:', error);
    }
  };

  const handleFileUpload = async () => {
    if (!state.client || state.files.length === 0) return;

    setState(prev => ({ ...prev, loading: true }));

    try {
        // Attempt to create the collection
        const options = {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${state.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ collection_name: 'default' })
        };

        await fetch('https://api.zeroentropy.dev/v1/collections/add-collection', options)
            .then(response => response.json())
            .then(response => {
                if (response.error && response.error.message.includes('already exists')) {
                    console.log('Collection already exists, proceeding with upload.');
                } else if (response.error) {
                    throw new Error(response.error.message);
                }
            })
            .catch(err => {
                console.error('Error creating collection:', err);
                throw err;
            });

        for (const file of state.files) {
            const base64Content = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const result = reader.result?.toString().split(',')[1];
                    result ? resolve(result) : reject('Failed to read file');
                };
                reader.onerror = () => reject(reader.error);
                reader.readAsDataURL(file);
            });

            await state.client.documents.add({
                collection_name: 'default',
                path: `documents/${file.name}`,
                content: {
                    type: 'auto',
                    base64_data: base64Content,
                },
                metadata: {
                    upload_timestamp: new Date().toISOString(),
                    filename: file.name,
                    content_type: file.type,
                    size: file.size.toString(),
                }
            });
        }

        await loadDocuments();
        setState(prev => ({
            ...prev,
            files: [],
            message: 'Files uploaded successfully!',
            loading: false
        }));
    } catch (error) {
        setState(prev => ({
            ...prev,
            message: 'Upload failed. Please try again.',
            loading: false
        }));
        console.error('Upload error:', error);
    }
  };

  const viewDocumentDetails = async (documentPath: string) => {
    if (!state.client) return;

    try {
      const response = await state.client.documents.getInfo({
        collection_name: 'default',
        path: documentPath,
        include_content: true
      });

      setState(prev => ({
        ...prev,
        selectedDocument: response.document
      }));
    } catch (error) {
      console.error('Document retrieval error:', error);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-blue-600">
        Advanced Document Management System
      </h1>

      {/* Authentication Section */}
      <div className="mb-8 p-4 bg-white rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Authentication</h2>
        <div className="flex gap-2">
          <input
            type="password"
            value={state.apiKey}
            onChange={e => setState(prev => ({ ...prev, apiKey: e.target.value }))}
            placeholder="Enter your API key"
            className="flex-1 p-2 border rounded"
          />
          <button
            onClick={handleAuthenticate}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Authenticate
          </button>
        </div>
      </div>

      {state.client && (
        <>
          {/* Upload Section */}
          <div className="mb-8 p-4 bg-white rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Upload Documents</h2>
            <div className="flex flex-col gap-4">
              <input
                type="file"
                multiple
                onChange={e => setState(prev => ({ 
                  ...prev, 
                  files: Array.from(e.target.files || [])
                }))}
                className="border p-2 rounded"
              />
              <button
                onClick={handleFileUpload}
                disabled={state.loading || state.files.length === 0}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400"
              >
                {state.loading ? 'Uploading...' : 'Upload Files'}
              </button>
            </div>
          </div>

          {/* Document Management Section */}
          <div className="p-4 bg-white rounded-lg shadow">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Documents</h2>
              <div className="flex gap-4">
                <input
                  type="text"
                  placeholder="Search documents..."
                  value={state.searchQuery}
                  onChange={e => setState(prev => ({ 
                    ...prev, 
                    searchQuery: e.target.value 
                  }))}
                  className="p-2 border rounded"
                />
                <select
                  value={state.filterStatus}
                  onChange={e => setState(prev => ({ 
                    ...prev, 
                    filterStatus: e.target.value 
                  }))}
                  className="p-2 border rounded"
                >
                  <option value="all">All Status</option>
                  <option value="indexed">Indexed</option>
                  <option value="indexing">Indexing</option>
                  <option value="not_indexed">Not Indexed</option>
                </select>
                <button
                  onClick={() => setState(prev => ({ 
                    ...prev, 
                    sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc' 
                  }))}
                  className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                >
                  Sort {state.sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              </div>
            </div>

            {/* Document List */}
            <div className="space-y-2">
              {state.documents.map((doc, index) => (
                <div
                  key={index}
                  className="p-3 border rounded hover:bg-gray-50 cursor-pointer"
                  onClick={() => viewDocumentDetails(doc.path)}
                >
                  <p className="font-medium">{doc.path}</p>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Status: {doc.index_status}</span>
                    <span>
                      Uploaded: {new Date(doc.metadata.upload_timestamp).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Document Details Modal */}
          {state.selectedDocument && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold">
                    Document Details
                  </h3>
                  <button
                    onClick={() => setState(prev => ({ ...prev, selectedDocument: null }))}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
                <div className="space-y-4">
                  <p><strong>Path:</strong> {state.selectedDocument.path}</p>
                  <p><strong>Status:</strong> {state.selectedDocument.index_status}</p>
                  <p><strong>Upload Date:</strong> {new Date(state.selectedDocument.metadata.upload_timestamp).toLocaleString()}</p>
                  <p><strong>File Type:</strong> {state.selectedDocument.metadata.content_type}</p>
                  <p><strong>Size:</strong> {(state.selectedDocument.metadata.size / 1024).toFixed(2)} KB</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Status Message */}
      {state.message && (
        <div className={`mt-4 p-4 rounded ${
          state.message.includes('failed')
            ? 'bg-red-100 text-red-700'
            : 'bg-green-100 text-green-700'
        }`}>
          {state.message}
        </div>
      )}
    </div>
  );
};

export default DocumentManager;