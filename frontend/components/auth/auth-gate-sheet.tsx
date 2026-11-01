"use client";

/**
 * Sign-in sheet (Firebase Auth): Google or a text code to a PH mobile.
 * Opens only when a guest tries an action; the action continues after sign-in.
 */
import { Button, OtpInput, PhoneInput, cn } from "@river-apps/ui";
import { ArrowLeft, MessageSquareText, Phone, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { RiverIcon } from "@/components/brand";
import { authErrorMessage, confirmPhoneCode, formatCooldown, pendingPhone, resendCooldownLeft, sendPhoneCode, signInWithGoogle } from "@/lib/auth";

type Step = "methods" | "phone" | "code";

export function AuthGateSheet({ open, subtitle, onClose, onAuthenticated }: { open: boolean; subtitle?: string; onClose: () => void; onAuthenticated?: () => void }) {
  if (!open) return null;
  return <Sheet subtitle={subtitle} onClose={onClose} onAuthenticated={onAuthenticated ?? onClose} />;
}

/** +639171234567 -> "917 123 4567" (matches PhoneInput's display). */
function formatNational(e164: string) {
  const d = e164.replace(/^\+63/, "");
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`.trim();
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.2-.2-1.8H9v3.4h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5z" />
      <path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.6-1.9.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.9 10.7A5.4 5.4 0 0 1 3.6 9c0-.6.1-1.2.3-1.7V5H.9A9 9 0 0 0 0 9c0 1.4.3 2.8.9 4l3-2.3z" />
      <path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.3L15 2.3A9 9 0 0 0 .9 5l3 2.3C4.6 5.2 6.6 3.6 9 3.6z" />
    </svg>
  );
}

function Sheet({ subtitle, onClose, onAuthenticated }: { subtitle?: string; onClose: () => void; onAuthenticated: () => void }) {
  // Reopening the sheet while a code is still fresh for a number goes straight back to the code step.
  const [resume] = useState(() => {
    const p = pendingPhone();
    return p && resendCooldownLeft(p.phoneE164) > 0 ? p.phoneE164 : null;
  });
  const [step, setStep] = useState<Step>(resume ? "code" : "methods");
  const [formatted, setFormatted] = useState(resume ? formatNational(resume) : "");
  const [e164, setE164] = useState<string | null>(resume);
  const [left, setLeft] = useState(() => (resume ? resendCooldownLeft(resume) : 0));
  // Tick the resend countdown once a second while it runs.
  useEffect(() => {
    const tick = () => setLeft(e164 ? resendCooldownLeft(e164) : 0);
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, [e164, step]);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onAuthenticated();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function sendCode(e?: FormEvent, buttonId = "auth-phone-send") {
    e?.preventDefault();
    if (!e164) {
      setError("Enter your 10-digit mobile number, e.g. 917 123 4567.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (resendCooldownLeft(e164) > 0 && pendingPhone()?.phoneE164 === e164) {
        setStep("code"); // a fresh code is already on its way to this number
        return;
      }
      await sendPhoneCode(e164, buttonId);
      setCode("");
      setLeft(resendCooldownLeft(e164));
      setStep("code");
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function verify(value = code) {
    if (value.length !== 6) return;
    setCode(value);
    void run(async () => { await confirmPhoneCode(value); });
  }


  const national = formatted || "your number";
  const title = step === "phone" ? "Your mobile number" : step === "code" ? "Enter the code" : "Sign up or log in";
  const sub = step === "phone"
    ? "We’ll text you a 6-digit code to sign in."
    : step === "code"
      ? `Code sent to +63 ${national}.`
      : subtitle ?? "Sign in to run your car wash. You can keep browsing without an account.";

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="auth-gate-title">
      <button type="button" className="absolute inset-0 bg-ink/45" aria-label="Dismiss" onClick={onClose} />
      <div className={cn("relative z-[1] flex w-full max-w-[440px] flex-col overflow-hidden rounded-t-[28px] bg-surface shadow-card sm:rounded-[28px]")}>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-[1] inline-flex size-9 items-center justify-center rounded-full bg-grey-100 text-ink hover:bg-grey-200"
          aria-label="Close"
        >
          <X size={16} strokeWidth={2.2} />
        </button>
        <div className="max-h-[min(80dvh,620px)] overflow-y-auto px-5 pb-6 pt-5">
          <RiverIcon size={40} />
          <h2 id="auth-gate-title" className="mt-3 pr-10 text-[24px] font-extrabold leading-[1.15] tracking-[-0.025em]">{title}</h2>
          <p className="mt-2 text-[14.5px] font-medium leading-snug text-muted">{sub}</p>

          {step === "methods" ? (
            <div className="mt-5 flex flex-col gap-2.5">
              <Button type="button" fullWidth disabled={busy} leadingIcon={<GoogleMark />} onClick={() => void run(async () => { await signInWithGoogle(); })}>
                Continue with Google
              </Button>
              <Button type="button" fullWidth variant="secondary" disabled={busy} leadingIcon={<Phone size={18} strokeWidth={2.2} />} onClick={() => { setError(null); setStep("phone"); }}>
                Continue with phone
              </Button>
            </div>
          ) : null}

          {step === "phone" ? (
            <form onSubmit={sendCode} className="mt-5 flex flex-col gap-2.5">
              <PhoneInput
                label="Mobile number"
                value={formatted}
                onChange={(f, v) => { setFormatted(f); setE164(v); setError(null); }}
              />
              <Button id="auth-phone-send" type="submit" fullWidth disabled={!e164 || busy || (left > 0 && pendingPhone()?.phoneE164 !== e164)} leadingIcon={<MessageSquareText size={18} strokeWidth={2.2} />}>
                {busy ? "Sending…" : left > 0 ? (pendingPhone()?.phoneE164 === e164 ? "Enter the code we sent" : `Resend code in ${formatCooldown(left)}`) : "Text me a code"}
              </Button>
              <Button type="button" fullWidth variant="ghost" leadingIcon={<ArrowLeft size={18} strokeWidth={2.2} />} onClick={() => setStep("methods")}>Back</Button>
            </form>
          ) : null}

          {step === "code" ? (
            <div className="mt-5 flex flex-col gap-3">
              <OtpInput value={code} onChange={setCode} onComplete={(v) => verify(v)} />
              <Button fullWidth disabled={code.length < 6 || busy} onClick={() => verify()}>{busy ? "Checking…" : "Verify & continue"}</Button>
              <Button id="auth-phone-resend" fullWidth variant="secondary" disabled={left > 0 || busy} onClick={() => void sendCode(undefined, "auth-phone-resend")} aria-live="polite">
                {left > 0 ? `Resend code in ${formatCooldown(left)}` : busy ? "Sending…" : "Resend code"}
              </Button>
              <Button fullWidth variant="ghost" onClick={() => { setCode(""); setStep("phone"); }}>Use a different number</Button>
            </div>
          ) : null}

          {error ? <p role="alert" className="mt-3 text-[13.5px] font-semibold text-[#C2410C]">{error}</p> : null}
          <p className="mt-4 text-center text-[12px] font-medium text-muted">By continuing you agree to our <a href="/terms" target="_blank" rel="noopener" className="underline">Terms</a> and <a href="/privacy" target="_blank" rel="noopener" className="underline">Privacy Policy</a>.</p>
        </div>
      </div>
    </div>
  );
}
