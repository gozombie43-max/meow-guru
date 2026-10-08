import { isAxiosError } from 'axios';
import type { TrainingDashboard } from '@/components/training/training-types';
import { useTrainingQuery } from './trainingQueries';

export function useTrainingDashboard(exam: string) {
  const { data, error, loading, retry } = useTrainingQuery<TrainingDashboard>('dashboard', exam);
  return {
    dashboard: data,
    error: error ? (isAxiosError(error) ? error.response?.data?.error || 'Could not load your training profile.' : 'Could not load training.') : '',
    loading,
    retry,
  };
}
