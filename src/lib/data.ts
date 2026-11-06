import { supabase } from './supabase';
import type { AnswerInput, Choice, Question, QuestionResult, Survey } from '../types';

const STORAGE_KEY = 'classroom-survey-demo';
type DemoState = { surveys: Survey[]; answers: Record<string, AnswerInput[][]>; responseTokens: Record<string, string[]> };
const id = () => crypto.randomUUID();
const slug = () => Math.random().toString(36).slice(2, 8);

function demoState(): DemoState {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return JSON.parse(saved) as DemoState;
  const state: DemoState = { surveys: [], answers: {}, responseTokens: {} };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  return state;
}
function saveDemo(state: DemoState) { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function withQuestions(survey: Survey): Survey { return { ...survey, questions: survey.questions ?? [] }; }

export async function listSurveys(): Promise<Survey[]> {
  if (!supabase) return demoState().surveys.map(withQuestions).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const { data, error } = await supabase.from('surveys').select('*, questions(*, choices(*))').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(withQuestions) as Survey[];
}
export async function getPublicSurvey(publicSlug: string): Promise<Survey | null> {
  if (!supabase) return demoState().surveys.find(s => s.public_slug === publicSlug && s.status === 'active') ?? null;
  const { data, error } = await supabase.from('surveys').select('*, questions(*, choices(*))').eq('public_slug', publicSlug).eq('status', 'active').maybeSingle();
  if (error) throw error;
  return data ? withQuestions(data as Survey) : null;
}
export async function saveSurvey(input: Pick<Survey, 'id' | 'title' | 'description'> & { questions: Question[] }): Promise<Survey> {
  const cleanQuestions = input.questions.map((q, qi) => ({ ...q, position: qi, choices: q.choices.map((c, ci) => ({ ...c, position: ci })) }));
  if (!supabase) {
    const state = demoState();
    const existing = state.surveys.find(s => s.id === input.id);
    const survey: Survey = { id: input.id || id(), title: input.title, description: input.description, status: existing?.status ?? 'draft', public_slug: existing?.public_slug ?? slug(), created_at: existing?.created_at ?? new Date().toISOString(), questions: cleanQuestions };
    state.surveys = existing ? state.surveys.map(s => s.id === survey.id ? survey : s) : [survey, ...state.surveys];
    saveDemo(state); return survey;
  }
  const { data: survey, error } = await supabase.from('surveys').upsert({ id: input.id || undefined, title: input.title, description: input.description, status: 'draft' }).select().single();
  if (error) throw error;
  await supabase.from('questions').delete().eq('survey_id', survey.id);
  for (const [qi, q] of cleanQuestions.entries()) {
    const { data: question, error: questionError } = await supabase.from('questions').insert({ survey_id: survey.id, question_text: q.question_text, question_type: q.question_type, position: qi }).select().single();
    if (questionError) throw questionError;
    if (q.choices.length) {
      const { error: choiceError } = await supabase.from('choices').insert(q.choices.map((c, ci) => ({ question_id: question.id, choice_text: c.choice_text, position: ci })));
      if (choiceError) throw choiceError;
    }
  }
  return (await listSurveys()).find(s => s.id === survey.id)!;
}
export async function updateStatus(survey: Survey, status: Survey['status']): Promise<void> {
  if (!supabase) {
    const state = demoState();
    if (status === 'active') state.surveys = state.surveys.map(s => s.status === 'active' ? { ...s, status: 'closed' } : s);
    state.surveys = state.surveys.map(s => s.id === survey.id ? { ...s, status, public_slug: s.public_slug || slug() } : s);
    saveDemo(state); return;
  }
  if (status === 'active') {
    const { error } = await supabase.rpc('activate_survey', { p_survey_id: survey.id });
    if (error) throw error;
  } else {
    const { error } = await supabase.from('surveys').update({ status }).eq('id', survey.id);
    if (error) throw error;
  }
}
export async function deleteSurvey(survey: Survey) {
  if (!supabase) { const state = demoState(); state.surveys = state.surveys.filter(s => s.id !== survey.id); saveDemo(state); return; }
  const { error } = await supabase.from('surveys').delete().eq('id', survey.id);
  if (error) throw error;
}
export async function submitResponse(surveyId: string, answers: AnswerInput[]) {
  const tokenKey = `classroom-survey-token-${surveyId}`;
  const token = localStorage.getItem(tokenKey) ?? id();
  localStorage.setItem(tokenKey, token);
  if (!supabase) {
    const state = demoState();
    if (state.responseTokens[surveyId]?.includes(token)) throw new Error('DUPLICATE_RESPONSE');
    state.answers[surveyId] = [...(state.answers[surveyId] ?? []), answers];
    state.responseTokens[surveyId] = [...(state.responseTokens[surveyId] ?? []), token];
    saveDemo(state); return;
  }
  const { error } = await supabase.rpc('submit_survey_response', { p_survey_id: surveyId, p_anonymous_token: token, p_answers: answers });
  if (error) throw error;
}
export async function getResults(survey: Survey): Promise<{ responseCount: number; questions: QuestionResult[] }> {
  if (!supabase) {
    const responses = demoState().answers[survey.id] ?? [];
    return { responseCount: responses.length, questions: survey.questions.map(q => ({
      question_id: q.id, question_text: q.question_text, response_count: responses.length,
      choices: q.choices.map(c => { const count = responses.filter(r => r.some(a => a.question_id === q.id && a.choice_id === c.id)).length; return { choice_id: c.id, choice_text: c.choice_text, count, percentage: responses.length ? Math.round(count / responses.length * 1000) / 10 : 0 }; })
    })) };
  }
  const { data: responses, error: responseError } = await supabase.from('responses').select('id').eq('survey_id', survey.id);
  if (responseError) throw responseError;
  const { data: answers, error: answerError } = await supabase.from('answers').select('question_id, choice_id').in('response_id', (responses ?? []).map(r => r.id));
  if (answerError) throw answerError;
  return { responseCount: responses?.length ?? 0, questions: survey.questions.map(q => ({ question_id: q.id, question_text: q.question_text, response_count: responses?.length ?? 0, choices: q.choices.map(c => { const count = (answers ?? []).filter(a => a.question_id === q.id && a.choice_id === c.id).length; return { choice_id: c.id, choice_text: c.choice_text, count, percentage: responses?.length ? Math.round(count / responses.length * 1000) / 10 : 0 }; }) })) };
}
export function newQuestion(surveyId = ''): Question { return { id: id(), survey_id: surveyId, question_text: '', question_type: 'multiple_choice', position: 0, choices: [{ id: id(), question_id: '', choice_text: '', position: 0 }, { id: id(), question_id: '', choice_text: '', position: 1 }] }; }
export function newSurvey(): Survey { return { id: id(), title: '', description: '', status: 'draft', public_slug: slug(), created_at: new Date().toISOString(), questions: [newQuestion()] }; }
