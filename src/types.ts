export type SurveyStatus = 'draft' | 'active' | 'closed' | 'archived';
export type QuestionType = 'multiple_choice' | 'true_false';

export interface Choice {
  id: string;
  question_id: string;
  choice_text: string;
  position: number;
}

export interface Question {
  id: string;
  survey_id: string;
  question_text: string;
  question_type: QuestionType;
  position: number;
  choices: Choice[];
}

export interface Survey {
  id: string;
  title: string;
  description: string;
  status: SurveyStatus;
  public_slug: string;
  created_at: string;
  questions: Question[];
}

export interface AnswerInput {
  question_id: string;
  choice_id: string;
}

export interface ResultChoice {
  choice_id: string;
  choice_text: string;
  count: number;
  percentage: number;
}

export interface QuestionResult {
  question_id: string;
  question_text: string;
  response_count: number;
  choices: ResultChoice[];
}
