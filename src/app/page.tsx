"use client";

/**
 * ============================================================================
 * 聊天主页面
 * ============================================================================
 *
 * 功能：提供类似 ChatGPT 的聊天界面
 * 特性：流式响应、思考过程展示、Markdown 渲染
 */

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, Bot, StopCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Thinking } from "@/components/Thinking";
import { cn } from "@/lib/utils";

// ============================================================================
// 类型定义
// ============================================================================

/** 消息结构 */
interface Message {
  role: "user" | "assistant";
  content: string;
  thinking?: string; // AI 的思考过程（仅 assistant 有）
}

// ============================================================================
// 主组件
// ============================================================================

export default function Home() {
  // --------------------------------------------------------------------------
  // 状态管理
  // --------------------------------------------------------------------------

  const [messages, setMessages] = useState<Message[]>([]); // 聊天记录
  const [input, setInput] = useState(""); // 输入框内容
  const [isLoading, setIsLoading] = useState(false); // 是否正在等待响应

  // --------------------------------------------------------------------------
  // DOM 引用
  // --------------------------------------------------------------------------

  const scrollRef = useRef<HTMLDivElement>(null); // 滚动容器
  const textareaRef = useRef<HTMLTextAreaElement>(null); // 输入框
  const abortRef = useRef<AbortController | null>(null); // 用于取消请求

  // --------------------------------------------------------------------------
  // 副作用
  // --------------------------------------------------------------------------

  /** 新消息时自动滚动到底部 */
  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  /** 输入框自动调整高度 */
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  // --------------------------------------------------------------------------
  // 事件处理
  // --------------------------------------------------------------------------

  /** 停止生成 */
  const handleStop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
  };

  /** 发送消息 */
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    // 1. 准备消息
    const userMessage: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];

    // 2. 更新 UI
    setMessages([...newMessages, { role: "assistant", content: "" }]);
    setInput("");
    setIsLoading(true);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    // 3. 创建可取消的请求
    abortRef.current = new AbortController();

    try {
      // 4. 发送请求（只发送 role 和 content，不发送 thinking）
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map(({ role, content }) => ({ role, content })),
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok || !response.body) throw new Error("请求失败");

      // 5. 读取 SSE 流
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let content = "";
      let thinking = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // 解析 SSE 数据
        const lines = decoder
          .decode(value, { stream: true })
          .split("\n")
          .filter((l) => l.startsWith("data:"));

        for (const line of lines) {
          const data = line.slice(5).trim();
          if (data === "[DONE]") continue;

          try {
            const json = JSON.parse(data);
            if (json.thinking) thinking += json.thinking;
            if (json.content) content += json.content;

            // 更新最后一条消息
            setMessages((prev) => [
              ...prev.slice(0, -1),
              { role: "assistant", content, thinking },
            ]);
          } catch {
            // 忽略解析错误
          }
        }
      }
    } catch (error: unknown) {
      // 非用户取消的错误
      if (error instanceof Error && error.name !== "AbortError") {
        console.error("错误:", error);
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { ...prev[prev.length - 1], content: prev[prev.length - 1].content + "\n\n[出错了，请重试]" },
        ]);
      }
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  };

  /** 回车发送（Shift+回车换行） */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // --------------------------------------------------------------------------
  // 渲染
  // --------------------------------------------------------------------------

  return (
    <div className="flex h-screen w-full flex-col bg-background text-foreground overflow-hidden">
      {/* 消息列表区域 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
          {/* 空状态 */}
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-2">
                <Bot className="w-6 h-6 text-foreground" />
              </div>
              <h2 className="text-xl font-medium">DeepSeek-R1</h2>
            </div>
          ) : (
            // 消息列表
            messages.map((msg, i) => {
              const isLast = i === messages.length - 1;
              const isThinking = isLoading && isLast && !!msg.thinking && !msg.content;

              return (
                <div
                  key={i}
                  className={cn(
                    "flex gap-4 w-full",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {/* AI 头像 */}
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-full border flex items-center justify-center shrink-0 mt-1 bg-muted">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={cn(
                      "flex flex-col max-w-[95%]",
                      msg.role === "user" ? "items-end" : "items-start"
                    )}
                  >
                    {/* 消息气泡 */}
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-3",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-transparent p-0 w-full"
                      )}
                    >
                      {/* 思考过程 */}
                      {msg.thinking && (
                        <Thinking content={msg.thinking} isStreaming={isThinking} />
                      )}

                      {/* 等待状态 */}
                      {isLoading && isLast && !msg.content && !msg.thinking && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-xs">等待响应...</span>
                        </div>
                      )}

                      {/* 正式回复（Markdown 渲染） */}
                      {msg.content && (
                        <div
                          className={cn(
                            "prose dark:prose-invert max-w-none text-sm leading-7 break-words",
                            msg.role === "user" ? "text-primary-foreground" : ""
                          )}
                        >
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              code: ({ className, children, ...props }) => {
                                const isInline = !className && !String(children).includes("\n");
                                return isInline ? (
                                  <code
                                    className="bg-muted-foreground/20 px-1.5 py-0.5 rounded text-sm font-mono"
                                    {...props}
                                  >
                                    {children}
                                  </code>
                                ) : (
                                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto my-2 text-sm font-mono">
                                    <code className={className} {...props}>
                                      {children}
                                    </code>
                                  </pre>
                                );
                              },
                              p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
                              ul: ({ children }) => <ul className="list-disc pl-4 mb-4">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal pl-4 mb-4">{children}</ol>,
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 输入区域 */}
      <div className="shrink-0 p-4 pb-6 bg-gradient-to-t from-background via-background to-transparent w-full flex justify-center">
        <div className="w-full max-w-2xl relative bg-background rounded-3xl border shadow-sm backdrop-blur-sm focus-within:ring-2 focus-within:ring-ring/20 transition-all">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="给 DeepSeek 发送消息..."
            className="block w-full bg-transparent border-none focus:ring-0 resize-none max-h-[200px] min-h-[52px] py-4 pl-5 pr-12 text-sm outline-none"
            rows={1}
            disabled={isLoading}
          />
          <div className="absolute right-2 bottom-2">
            {isLoading ? (
              <Button
                size="icon"
                variant="secondary"
                className="h-8 w-8 rounded-full bg-black text-white hover:bg-black/80 dark:bg-white dark:text-black"
                onClick={handleStop}
              >
                <StopCircle className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="icon"
                disabled={!input.trim()}
                className="h-8 w-8 rounded-full bg-black text-white hover:bg-black/80 dark:bg-white dark:text-black disabled:opacity-30"
                onClick={() => handleSubmit()}
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
