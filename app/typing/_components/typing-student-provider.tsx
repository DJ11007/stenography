"use client";

import { createContext, useContext } from "react";

export type TypingStudent = { name: string; email: string; phone: string | null };
const StudentContext = createContext<TypingStudent | null>(null);

export function TypingStudentProvider({ student, children }: { student: TypingStudent; children: React.ReactNode }) {
  return <StudentContext.Provider value={student}>{children}</StudentContext.Provider>;
}

export function useTypingStudent() {
  const student = useContext(StudentContext);
  if (!student) throw new Error("Typing student context is unavailable.");
  return student;
}

