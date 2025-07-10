import { create } from 'zustand';
import { TaskListItem } from './types';

interface TaskStore {
  tasks: TaskListItem[];
  setTasks: (tasks: TaskListItem[]) => void;
  addTask: (task: TaskListItem) => void;
  updateTask: (task: TaskListItem) => void;
  deleteTask: (taskId: string) => void;
  clearTasks: () => void;
}

export const useTaskStore = create<TaskStore>((set) => ({
  tasks: [],
  setTasks: (tasks) => set({ tasks }),
  addTask: (task) => set((state) => ({ tasks: [task, ...state.tasks] })),
  updateTask: (task) => set((state) => ({
    tasks: state.tasks.map((t) => (t.id === task.id ? { ...t, ...task } : t)),
  })),
  deleteTask: (taskId) => set((state) => ({
    tasks: state.tasks.filter((t) => t.id !== taskId),
  })),
  clearTasks: () => set({ tasks: [] }),
})); 