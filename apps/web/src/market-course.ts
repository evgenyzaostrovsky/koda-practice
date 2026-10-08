import type { ExerciseMode, Module } from "./types";

export type MarketLesson = { id: string; title: string; exercise_mode: ExerciseMode; taskIds: string[] };
export type MarketCourse = { id: "koda-market"; title: string; lessons: MarketLesson[] };
export const marketCourseQuery = {
  queryKey: ["market-course"],
  queryFn: async (): Promise<MarketCourse> => {
    const response = await fetch("/market-course.json");
    if (!response.ok) throw new Error("Не удалось загрузить проект KODA Market.");
    const course = await response.json() as MarketCourse;
    if (course.id !== "koda-market" || !Array.isArray(course.lessons) || course.lessons.some(lesson => !Array.isArray(lesson.taskIds) || !lesson.taskIds.length)) throw new Error("Маршрут проекта недоступен.");
    return course;
  },
  staleTime: 60_000,
};
export function marketTaskHref(taskId: string, lessonId: string) {
  return `/practice/${encodeURIComponent(taskId)}?course=koda-market&lesson=${encodeURIComponent(lessonId)}`;
}
export function marketLessonTasks(lesson: MarketLesson, modules: Module[]) {
  const tasks = new Map(modules.flatMap(module => module.topics.flatMap(topic => topic.exercises.map(exercise => [exercise.id, exercise] as const))));
  return lesson.taskIds.map(id => tasks.get(id));
}
