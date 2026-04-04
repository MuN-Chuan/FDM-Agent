import { Home, MoveRight, Loader2 } from 'lucide-react';
import { useVisionControl } from './useVisionControl';

interface VisionControlPanelProps {
  printerId: string;
}

export function VisionControlPanel(_props: VisionControlPanelProps) {
  const { 
    homePrinter, 
    moveAxis, 
    isRunning, 
    lastResult,
    isConnected 
  } = useVisionControl();

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">截图控制</h3>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            isConnected 
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' 
              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
          }`}>
            {isConnected ? '已连接' : '未连接'}
          </span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => homePrinter()}
            disabled={isRunning || !isConnected}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-100"
          >
            {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Home size={14} />}
            {isRunning ? '执行中...' : '回中 (Home)'}
          </button>
          
          <button
            onClick={() => moveAxis('X', 10)}
            disabled={isRunning || !isConnected}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-100"
          >
            <MoveRight size={14} />
            X+10mm
          </button>
          
          <button
            onClick={() => moveAxis('Y', 10)}
            disabled={isRunning || !isConnected}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-100"
          >
            <MoveRight size={14} />
            Y+10mm
          </button>
          
          <button
            onClick={() => moveAxis('Z', 1)}
            disabled={isRunning || !isConnected}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-100"
          >
            <MoveRight size={14} />
            Z+1mm
          </button>
        </div>

        {lastResult && (
          <div className="p-2 bg-slate-100 dark:bg-slate-700/50 rounded">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {lastResult.success 
                ? `执行成功: ${lastResult.action} at (${lastResult.x}, ${lastResult.y})`
                : `失败: ${lastResult.error}`
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}