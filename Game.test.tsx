// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import Game from "./Game";

function setup(letter = "م") {
  const onFinish = vi.fn();
  const onQuit = vi.fn();
  render(
    <Game letter={letter} baseScore={0} muted={true} onToggleMute={() => {}} onFinish={onFinish} onQuit={onQuit} />
  );
  return { onFinish, onQuit };
}

function getForms() { return Array.from(document.querySelectorAll("form")) as HTMLFormElement[]; }
function getInputs() { return Array.from(document.querySelectorAll("form input")) as HTMLInputElement[]; }

describe("Game — القفل التلقائي بدون Enter", () => {
  beforeEach(() => { cleanup(); localStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("Enter لا يعمل أي شيء — الإجابة تتقفل أوتوماتيك", () => {
    setup("م");
    const inputs = getInputs();
    fireEvent.change(inputs[0], { target: { value: "محمد" } });
    // نضغط Enter (submit) قبل أي تايمر
    fireEvent.submit(getForms()[0]);
    expect(document.body.textContent).not.toContain("صح"); // لسه مالوش قفل
    // بعد ما نوقف كتابة، بتتقفل لوحدها
    act(() => { vi.advanceTimersByTime(900); });
    expect(document.body.textContent).toContain("محمد");
    expect(document.body.textContent).toContain("صح");
  });

  it("إجابة مقبولة تقفل تلقائيًا بعد تأكد", () => {
    setup("م");
    const inputs = getInputs();
    // كلمة عربية سليمة مش في القاموس
    fireEvent.change(inputs[0], { target: { value: "معطف" } });
    act(() => { vi.advanceTimersByTime(1000); });
    // لسه مقبولة بتستنى
    expect(document.body.textContent).not.toContain("صح");
    act(() => { vi.advanceTimersByTime(1300); });
    expect(document.body.textContent).toContain("معطف");
  });

  it("كلمات متكتبة من غير تأكيد بتتحسب عند الوقف", () => {
    const { onFinish } = setup("م");
    const inputs = getInputs();
    fireEvent.change(inputs[0], { target: { value: "محمد" } });
    fireEvent.change(inputs[1], { target: { value: "منى" } });
    const stopBtns = screen.getAllByRole("button").filter((b) => b.textContent?.includes("خلصت"));
    fireEvent.click(stopBtns[0]);
    const confirmBtns = screen.getAllByRole("button").filter((b) => b.textContent?.includes("متأكد"));
    fireEvent.click(confirmBtns[0]);
    expect(onFinish).toHaveBeenCalledTimes(1);
    const answers = onFinish.mock.calls[0][0] as Array<{ cat: string; verdict: { t: string } | null }>;
    expect(answers.find((a) => a.cat === "boy")?.verdict?.t).toBe("exact");
    expect(answers.find((a) => a.cat === "girl")?.verdict?.t).toBe("exact");
  });

  it("نهاية الوقت بتجمع المكتوب وتبعت النتايج", () => {
    const { onFinish } = setup("م");
    const inputs = getInputs();
    fireEvent.change(inputs[3], { target: { value: "مستكة" } });
    for (let i = 0; i < 18; i++) act(() => { vi.advanceTimersByTime(5_000); });
    expect(onFinish).toHaveBeenCalledTimes(1);
    const answers = onFinish.mock.calls[0][0] as Array<{ cat: string; verdict: { t: string } | null }>;
    expect(answers.find((a) => a.cat === "plant")?.verdict?.t).toBe("exact");
  });
});
