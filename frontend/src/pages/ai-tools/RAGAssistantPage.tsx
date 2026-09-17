import { useState } from "react";
import { api } from "@/api/client";

interface RAGSource {
  chunk_id: string;
  document_title: string;
}

interface RAGResponse {
  answer: string;
  sources: RAGSource[];
  aiRequestId: string;
}

export default function RAGAssistantPage() {
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState<RAGResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAsk = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setError("");
    setResponse(null);

    try {
      const res = await api.post("/ai/rag/query", { question });
      setResponse(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to get response from RAG assistant");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Hospital Knowledge Assistant</h1>
      <p className="text-gray-500 mb-6">
        Ask questions about hospital SOPs, policies, guidelines, and procedures.
        Answers are generated from your hospital's uploaded documents.
      </p>

      {/* Query Input */}
      <div className="flex gap-3 mb-6">
        <input
          type="text"
          className="flex-1 border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          placeholder='e.g., "What is the hospital procedure for patient discharge?"'
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAsk()}
        />
        <button
          onClick={handleAsk}
          disabled={loading || !question.trim()}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {loading ? "Searching..." : "Ask"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">
          {error}
        </div>
      )}

      {/* Response */}
      {response && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="p-6">
            <h3 className="font-semibold text-lg mb-3">Answer</h3>
            <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">
              {response.answer}
            </div>
          </div>

          {response.sources.length > 0 && (
            <div className="border-t border-gray-100 p-6 bg-gray-50 rounded-b-lg">
              <h4 className="font-medium text-sm text-gray-500 mb-2">Sources</h4>
              <div className="flex flex-wrap gap-2">
                {response.sources.map((src, i) => (
                  <span
                    key={src.chunk_id || i}
                    className="bg-blue-100 text-blue-800 text-xs px-3 py-1 rounded-full"
                  >
                    {src.document_title}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Example questions */}
      {!response && !loading && (
        <div className="mt-8">
          <h3 className="text-sm font-medium text-gray-500 mb-3">Example questions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              "What is the hospital procedure for patient discharge?",
              "What are the infection control guidelines?",
              "How to handle a medical emergency?",
              "What is the leave policy for staff?",
            ].map((q) => (
              <button
                key={q}
                className="text-left border border-gray-200 rounded-lg p-3 hover:bg-gray-50 text-sm text-gray-600"
                onClick={() => {
                  setQuestion(q);
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
