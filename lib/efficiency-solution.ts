// A Word/Excel question's paper-solution fields as read from the admin form: text trimmed and capped, image only a
// small image data URI (migrations 202610261000 and 202610261200 check the same limits).
export function cleanSolution(question: { solution?: unknown; solution_image?: unknown }) {
  return {
    solution: typeof question.solution === "string" && question.solution.trim() ? question.solution.trim().slice(0, 8000) : null,
    solution_image: typeof question.solution_image === "string" && question.solution_image.length <= 700000 && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(question.solution_image) ? question.solution_image : null,
  };
}
