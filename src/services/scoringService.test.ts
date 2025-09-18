// src/services/scoringService.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyScoreFloor } from './scoringService';
import { ResumeData } from '../types/resume';

// Helper to create base resume data with all sections populated
const createBaseResume = (): ResumeData => ({
  name: 'John Doe',
  phone: '1234567890',
  email: 'john@example.com',
  linkedin: 'linkedin.com/in/johndoe',
  github: 'github.com/johndoe',
  summary: 'Experienced developer.',
  education: [{ degree: 'B.Tech', school: 'XYZ University', year: '2020' }],
  workExperience: [{ role: 'Dev', company: 'ABC', year: '2021', bullets: ['Did stuff'] }],
  projects: [{ title: 'Proj', bullets: ['Did proj'] }],
  skills: [{ category: 'Programming', count: 1, list: ['JS'] }],
  certifications: []
});

test('applies floor when all required sections are present', () => {
  const resume = createBaseResume();
  const result = applyScoreFloor(80, resume);
  assert.equal(result, 90);
});

test('does not apply floor when a required section is missing', () => {
  const resume = createBaseResume();
  resume.projects = [];
  const result = applyScoreFloor(80, resume);
  assert.equal(result, 80);
});

test('applies floor when origin is guided', () => {
  const resume = createBaseResume();
  resume.origin = 'guided';
  const result = applyScoreFloor(80, resume);
  assert.equal(result, 90);
});

test('applies floor when origin is jd_optimized', () => {
  const resume = createBaseResume();
  resume.origin = 'jd_optimized';
  const result = applyScoreFloor(80, resume);
  assert.equal(result, 90);
});

test('does not apply floor when origin is neither guided nor jd_optimized', () => {
  const resume = createBaseResume();
  resume.origin = 'manual'; // Some other origin
  const result = applyScoreFloor(80, resume);
  assert.equal(result, 80);
});

test('applies floor correctly if calculated score is already above 90', () => {
  const resume = createBaseResume();
  resume.origin = 'jd_optimized';
  const result = applyScoreFloor(95, resume);
  assert.equal(result, 95);
});

