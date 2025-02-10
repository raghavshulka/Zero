import React, { useState, useRef, useEffect } from 'react';
import { ZeroEntropy } from 'zeroentropy';
import ReactMarkdown from 'react-markdown';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  snippets?: Array<{
    content: string;
    path: string;
    score: number;
  }>;
}

interface ChatbotProps {
  client: ZeroEntropy | null;
  collectionName: string;
}

const DocumentChatbot: React.FC<ChatbotProps> = ({ client, collectionName }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'system',
      content: 'Hello! I can help you understand the ZeroEntropy documentation. Try asking questions like:\n\n' +
        '• How do I install ZeroEntropy?\n' +
        '• How do I create a collection?\n' +
        '• What are the available query methods?\n' +
        '• How do I handle document metadata?'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const processQuery = async (query: string) => {
    try {
      // First try to get top documents for a broader context
      const docsResponse = await client!.queries.topDocuments({
        collection_name: collectionName,
        query: query,
        k: 3,
        include_metadata: true
      });

      // Then get specific snippets for precise answers
      const snippetsResponse = await client!.queries.topSnippets({
        collection_name: collectionName,
        query: query,
        k: 3,
        precise_responses: true
      });

      // For page-specific queries, get page content
      const pagesResponse = query.toLowerCase().includes('page') ? 
        await client!.queries.topPages({
          collection_name: collectionName,
          query: query,
          k: 3,
          include_content: true
        }) : null;

      return formatResponse({
        documents: docsResponse.results,
        snippets: snippetsResponse.results,
        pages: pagesResponse?.results,
        query
      });
    } catch (error) {
      console.error('Error querying documents:', error);
      return {
        content: 'Sorry, I encountered an error while searching the documentation.',
        snippets: []
      };
    }
  };

  const formatResponse = ({
    documents,
    snippets,
    pages,
    query
  }: {
    documents: any[];
    snippets: any[];
    pages?: any[];
    query: string;
  }) => {
    if (!documents.length && !snippets.length && !pages?.length) {
      return {
        content: "I couldn't find any relevant information. Please try rephrasing your question.",
        snippets: []
      };
    }

    let response = '';

    // Handle document listing
    if (query.toLowerCase().includes('show') && 
        (query.toLowerCase().includes('document') || query.toLowerCase().includes('all'))) {
      const uniqueDocs = Array.from(new Set(documents.map(d => d.path)));
      response = "Here are the available documents:\n\n";
      uniqueDocs.forEach((path, i) => response += `${i + 1}. **${path}**\n`);
    }
    // Handle page-specific queries
    else if (pages?.length) {
      response = "Here are the relevant pages:\n\n";
      pages.forEach(page => {
        response += `From document \`${page.path}\` (Page ${page.page_index + 1}):\n`;
        response += `${page.content}\n\n`;
      });
    }
    // Handle specific content queries
    else {
      response = "Here's what I found:\n\n";
      snippets.forEach(snippet => {
        response += `${snippet.content}\n\n`;
        if (snippet.page_span) {
          response += `*Source: \`${snippet.path}\` (Pages ${snippet.page_span[0] + 1}-${snippet.page_span[1] + 1}, Relevance: ${(snippet.score * 100).toFixed(1)}%)*\n\n`;
        } else {
          response += `*Source: \`${snippet.path}\` (Relevance: ${(snippet.score * 100).toFixed(1)}%)*\n\n`;
        }
      });
    }

    return { 
      content: response, 
      snippets,
      documents,
      pages 
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !client) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const { content, snippets } = await processQuery(input);

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content,
      snippets
    };

    setMessages(prev => [...prev, assistantMessage]);
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-lg shadow">
      <div className="p-4 border-b bg-blue-500 text-white rounded-t-lg">
        <h2 className="text-xl font-semibold">ZeroEntropy Documentation Assistant</h2>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(message => (
          <div
            key={message.id}
            className={`flex ${
              message.role === 'user' 
                ? 'justify-end' 
                : message.role === 'system' 
                  ? 'justify-center' 
                  : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[80%] p-4 rounded-lg ${
                message.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : message.role === 'system'
                  ? 'bg-gray-200 text-gray-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              <ReactMarkdown 
                className="prose prose-sm max-w-none"
                components={{
                  pre: ({ node, ...props }) => (
                    <div className="bg-gray-800 text-white p-2 rounded my-2 overflow-x-auto">
                      <pre {...props} />
                    </div>
                  ),
                  code: ({ node, ...props }: { node?: any } & React.HTMLProps<HTMLElement>) => (
                    props.className?.includes('inline') 
                      ? <code className="bg-gray-200 px-1 rounded" {...props} />
                      : <code {...props} />
                  )
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 p-3 rounded-lg">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-4 border-t bg-gray-50">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about ZeroEntropy documentation..."
            className="flex-1 p-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 shadow-sm transition-colors"
          >
            {isLoading ? 'Searching...' : 'Ask'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default DocumentChatbot; 