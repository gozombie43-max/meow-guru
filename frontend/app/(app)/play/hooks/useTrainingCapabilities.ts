import type { TrainingCapabilities } from '@/components/training/training-types';
import { useTrainingQuery } from './trainingQueries';

export function useTrainingCapabilities() {
  const { data, error, loading, retry } = useTrainingQuery<TrainingCapabilities>('capabilities');
  return { capabilities: data, error: error ? 'Could not load training capabilities.' : '', loading, retry };
}
