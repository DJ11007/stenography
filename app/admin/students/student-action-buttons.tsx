"use client";

import { useActionState } from "react";
import {
  confirmStudentEmailManually,
  resendStudentConfirmation,
  sendStudentPasswordReset,
  setStudentActive,
  setStudentApproved,
  type StudentActionState,
} from "./actions";

const initial: StudentActionState = {};

export function StudentActionButtons({ studentId, emailConfirmed, isActive, approved }: { studentId: string; emailConfirmed: boolean; isActive: boolean; approved: boolean }) {
  const [resendState, resendAction, resendPending] = useActionState(resendStudentConfirmation, initial);
  const [confirmState, confirmAction, confirmPending] = useActionState(confirmStudentEmailManually, initial);
  const [resetState, resetAction, resetPending] = useActionState(sendStudentPasswordReset, initial);
  const [activeState, activeAction, activePending] = useActionState(setStudentActive, initial);
  const [approvedState, approvedAction, approvedPending] = useActionState(setStudentApproved, initial);

  return (
    <div className="flex flex-col gap-2">
      {!approved && (
        <form action={approvedAction}>
          <input type="hidden" name="studentId" value={studentId} />
          <input type="hidden" name="approved" value="true" />
          <button disabled={approvedPending} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-60">{approvedPending ? "Approving…" : "Approve account"}</button>
        </form>
      )}
      {!emailConfirmed && (
        <div className="flex flex-wrap gap-2">
          <form action={resendAction}>
            <input type="hidden" name="studentId" value={studentId} />
            <button disabled={resendPending} className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-200 disabled:opacity-60">{resendPending ? "Sending…" : "Resend confirmation email"}</button>
          </form>
          <form action={confirmAction} onSubmit={(event) => { if (!confirm("Manually confirm this student's email? They will be able to sign in immediately.")) event.preventDefault(); }}>
            <input type="hidden" name="studentId" value={studentId} />
            <button disabled={confirmPending} className="rounded-lg bg-blue-100 px-3 py-1.5 text-xs font-bold text-blue-900 hover:bg-blue-200 disabled:opacity-60">{confirmPending ? "Confirming…" : "Confirm manually"}</button>
          </form>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <form action={resetAction}>
          <input type="hidden" name="studentId" value={studentId} />
          <button disabled={resetPending} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-200 disabled:opacity-60">{resetPending ? "Sending…" : "Send password reset link"}</button>
        </form>
        <form action={activeAction} onSubmit={(event) => { if (!confirm(isActive ? "Deactivate this student's account? They will not be able to sign in." : "Reactivate this student's account?")) event.preventDefault(); }}>
          <input type="hidden" name="studentId" value={studentId} />
          <input type="hidden" name="active" value={String(!isActive)} />
          <button disabled={activePending} className={`rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-60 ${isActive ? "bg-red-100 text-red-800 hover:bg-red-200" : "bg-green-100 text-green-800 hover:bg-green-200"}`}>{activePending ? "Saving…" : isActive ? "Deactivate account" : "Reactivate account"}</button>
        </form>
        {approved && (
          <form action={approvedAction} onSubmit={(event) => { if (!confirm("Revoke approval for this student? They will not be able to sign in until re-approved.")) event.preventDefault(); }}>
            <input type="hidden" name="studentId" value={studentId} />
            <input type="hidden" name="approved" value="false" />
            <button disabled={approvedPending} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-200 disabled:opacity-60">{approvedPending ? "Saving…" : "Revoke approval"}</button>
          </form>
        )}
      </div>
      {[resendState, confirmState, resetState, activeState, approvedState].map((state, index) => (
        <div key={index}>
          {state.error && <p role="alert" className="text-xs font-bold text-red-700">{state.error}</p>}
          {state.success && <p className="text-xs font-bold text-green-700">{state.success}</p>}
        </div>
      ))}
    </div>
  );
}
