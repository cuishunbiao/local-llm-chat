/**
 * ============================================================================
 * Ollama Chat API 路由
 * ============================================================================
 *
 * 功能：作为前端与 Ollama 本地大模型之间的桥梁
 * 协议：使用 SSE (Server-Sent Events) 实现流式响应
 *
 * 数据流向：
 * 前端 → Next.js API → Ollama → Next.js API → 前端
 *        (本文件)      (本地LLM)   (本文件)
 */

import { NextRequest } from "next/server";

// ============================================================================
// 配置常量
// ============================================================================

/** Ollama 服务地址（本地运行） */
const OLLAMA_URL = "http://localhost:11434/api/chat";

/** 默认使用的模型（Qwen3:14b 支持思考过程输出） */
const MODEL = "qwen3:14b";

// ============================================================================
// 类型定义
// ============================================================================

/** 聊天消息结构 */
interface Message {
  role: "user" | "assistant";
  content: string;
}

/** 请求体结构 */
interface ChatRequest {
  messages: Message[];
  model?: string;
}


// ============================================================================
// Next.js 配置
// ============================================================================

/** 禁用缓存，确保每次请求都是新鲜的 */
export const dynamic = "force-dynamic";

/** 使用 Node.js 运行时（支持流式处理） */
export const runtime = "nodejs";

// ============================================================================
// API 处理函数
// ============================================================================

/**
 * POST /api/chat
 *
 * 处理聊天请求，将消息转发给 Ollama 并以 SSE 格式返回流式响应
 *
 * @param request - 包含 messages 数组的 POST 请求
 * @returns SSE 流式响应，格式为 data: {thinking?, content?}\n\n
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 解析请求体
    const { messages, model = MODEL }: ChatRequest = await request.json();

    // 2. 调用 Ollama API（启用流式输出）
    const ollamaResponse = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, stream: true }),
      cache: "no-store", // 禁用 fetch 缓存
    });

    // 3. 错误处理
    if (!ollamaResponse.ok || !ollamaResponse.body) {
      return Response.json({ error: "Ollama 连接失败" }, { status: 500 });
    }

    // 4. 创建 SSE 流，转发 Ollama 的响应
    const stream = new ReadableStream({
      async start(controller) {
        const reader = ollamaResponse.body!.getReader();
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();

        try {
          // 持续读取 Ollama 的流式响应
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // 解析 Ollama 返回的 NDJSON 数据
            const lines = decoder.decode(value, { stream: true }).split("\n");

            for (const line of lines) {
              if (!line.trim()) continue;

              try {
                const json = JSON.parse(line);

                // 提取思考过程和正式回复
                const { thinking, content } = json.message || {};

                // 有内容则推送给前端
                if (thinking || content) {
                  const sseData = `data: ${JSON.stringify({ thinking, content })}\n\n`;
                  controller.enqueue(encoder.encode(sseData));
                }

                // 响应完成标记
                if (json.done) {
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                }
              } catch {
                // 忽略 JSON 解析错误（可能是不完整的数据块）
              }
            }
          }
        } finally {
          controller.close();
          reader.releaseLock();
        }
      },
    });

    // 5. 返回 SSE 响应
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream", // SSE 标准类型
        "Cache-Control": "no-cache", // 禁用缓存
        Connection: "keep-alive", // 保持连接
      },
    });
  } catch (error) {
    console.error("Chat API 错误:", error);
    return Response.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
