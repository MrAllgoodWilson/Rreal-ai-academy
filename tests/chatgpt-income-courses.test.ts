import { describe, expect, it } from 'vitest';
import { ALL_TRACKS, getLessonRef, lessonsForTrack } from '../src/lib/curriculum';
import { CHATGPT_INCOME_COURSES } from '../src/lib/curriculum/chatgpt-income-courses';
describe('ChatGPT foundations and ten distinct income courses', () => {
  it('provides one complete ChatGPT course and ten business tool courses', () => {
    expect(CHATGPT_INCOME_COURSES).toHaveLength(11);
    expect(CHATGPT_INCOME_COURSES[0].id).toBe('c-chatgpt-complete-2026');
    expect(CHATGPT_INCOME_COURSES[0].weeks.flatMap(w=>w.modules.flatMap(m=>m.lessons))).toHaveLength(20);
    for (const c of CHATGPT_INCOME_COURSES.slice(1)) expect(c.weeks.flatMap(w=>w.modules.flatMap(m=>m.lessons))).toHaveLength(5);
  });
  it('each lesson is indexed, has quiz, practice, safeguards and unique identifiers', () => {
    const ids=new Set<string>(); const quizIds=new Set<string>();
    for(const c of CHATGPT_INCOME_COURSES) {
      expect(ALL_TRACKS.some(x=>x.id===c.id)).toBe(true);
      for(const r of lessonsForTrack(c.id)) {
        const l=r.lesson; expect(getLessonRef(l.id)?.track.id).toBe(c.id);
        expect(ids.has(l.id)).toBe(false); ids.add(l.id);
        const quizzes=l.blocks.filter(x=>x.type==='quiz'); expect(quizzes).toHaveLength(1);
        for(const q of quizzes) if(q.type==='quiz') {
          expect(q.answer).toBeGreaterThanOrEqual(0); expect(q.answer).toBeLessThan(q.options.length);
          expect(quizIds.has(q.id)).toBe(false); quizIds.add(q.id);
        }
        expect(l.blocks.some(x=>x.type==='prompt-lab')).toBe(true);
        expect(l.blocks.some(x=>x.type==='reflect')).toBe(true);
        expect(l.blocks.some(x=>x.type==='tip')).toBe(true);
      }
    }
    expect(ids.size).toBe(70);
  });
  it('income claims are bounded and humans verify outputs', () => {
    for(const c of CHATGPT_INCOME_COURSES) for(const l of c.weeks.flatMap(w=>w.modules.flatMap(m=>m.lessons))) {
      const content=l.blocks.map(b=>JSON.stringify(b)).join(' ');
      expect(content).toMatch(/human|review|verify|check/i);
      expect(content).not.toMatch(/you will earn \$|earn \$[0-9]+ daily|100% profit/i);
    }
  });
});
