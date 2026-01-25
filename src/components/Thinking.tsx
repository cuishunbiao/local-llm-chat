/**
 * ============================================================================
 * 思考过程展示组件
 * ============================================================================
 *
 * 功能：展示 AI 的思考过程（类似 DeepSeek-R1 的 Chain of Thought）
 * 特性：可折叠、流式动画
 */

import { useState } from "react";
import { ChevronDown, ChevronRight, BrainCircuit, Loader2 } from "lucide-react";

// ============================================================================
// 类型定义
// ============================================================================

interface ThinkingProps {
  content: string; // 思考内容
  isStreaming?: boolean; // 是否正在流式输出
}

// ============================================================================
// 组件
// ============================================================================

export function Thinking({ content, isStreaming = false }: ThinkingProps) {
  /** 控制折叠状态 */
  const [isOpen, setIsOpen] = useState(true);

  // 无内容时不渲染
  if (!content) return null;

  return (
    <div className="mb-4 rounded-lg border bg-muted/50 overflow-hidden">
      {/* 标题栏（可点击折叠） */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:bg-muted/80 transition-colors"
      >
        {/* 图标：流式时显示加载动画 */}
        {isStreaming ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <BrainCircuit className="w-4 h-4" />
        )}

        {/* 标题文字 */}
        <span className="font-medium">{isStreaming ? "正在思考..." : "思考过程"}</span>

        {/* 折叠箭头 */}
        {isOpen ? (
          <ChevronDown className="w-4 h-4 ml-auto" />
        ) : (
          <ChevronRight className="w-4 h-4 ml-auto" />
        )}
      </button>

      {/* 内容区域 */}
      {isOpen && (
        <div className="px-4 py-3 text-sm text-muted-foreground border-t bg-muted/30 whitespace-pre-wrap leading-relaxed animate-in slide-in-from-top-2 fade-in duration-200">
          {content}
          {/* 流式输出时显示光标 */}
          {isStreaming && (
            <span className="inline-block w-1.5 h-4 bg-muted-foreground/50 ml-0.5 animate-pulse" />
          )}
        </div>
      )}
    </div>
  );
}
