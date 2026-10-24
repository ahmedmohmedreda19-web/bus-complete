import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props { children: ReactNode }
interface State { error: Error | null }

/** حاجز أمان: أي خطأ غير متوقع يعرض شاشة ودّية بدل شاشة فاضية */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // نسيب أثر في الكونسول وللتخزين المحلي للتشخيص
    console.error("خطأ في اللعبة:", error, info.componentStack);
    try {
      localStorage.setItem(
        "busComplete.lastError",
        JSON.stringify({ msg: error.message, stack: (error.stack ?? "").slice(0, 900), at: Date.now() })
      );
    } catch { /* اتجاهل */ }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-dvh flex items-center justify-center p-4" dir="rtl">
        <div className="modal-solid rounded-3xl p-6 w-full max-w-sm text-center pop-in">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-rose-400/15 border border-rose-300/35 flex items-center justify-center mb-3 text-4xl">
            🚧
          </div>
          <h2 className="font-display text-2xl font-extrabold mb-1 text-rose-100">الأتوبيس فرمل فجأة!</h2>
          <p className="text-white/60 font-bold text-sm leading-6 mb-4">
            حصلت مشكلة غير متوقعة… معلش. اضغط تحت وهترجع تلعب على طول من غير ما تفقد جنيهك أو قاموسك.
          </p>
          <div className="space-y-2">
            <button
              onClick={() => this.setState({ error: null })}
              className="btn-primary w-full py-3 text-lg"
            >
              كمّل لعب
            </button>
            <button
              onClick={() => {
                // إعادة تحميل إجبارية تتخطى الكاش القديم
                const url = new URL(window.location.href);
                url.searchParams.set("fresh", String(Date.now()));
                window.location.replace(url.toString());
              }}
              className="btn-ghost w-full py-3 font-bold text-white/70"
            >
              تحديث جديد + إعادة تشغيل
            </button>
          </div>
          <details className="mt-4 text-right">
            <summary className="text-[11px] font-bold text-white/35 cursor-pointer">تفاصيل تقنية</summary>
            <pre className="mt-2 text-[10px] text-white/40 bg-black/30 rounded-xl p-2 overflow-auto max-h-32 whitespace-pre-wrap" dir="ltr">
              {error.message}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}
