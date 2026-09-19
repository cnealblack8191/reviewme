/** The supervisor's working copy of a review, shared by the phone form and the server actions. */
export interface SupervisorDraft {
  answers: Record<string, { rating: number | null; comment: string }>;
  overallRating: number | null;
  overallComments: string;
  goals: string;
}
