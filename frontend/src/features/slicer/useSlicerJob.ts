import { useCallback, useRef, useState } from 'react';

import type { Modification, SlicerJobResult } from '../../api/api';
import { api } from '../../api/api';

export type SlicerJobPhase = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

interface UseSlicerJobReturn {
    phase: SlicerJobPhase;
    result: SlicerJobResult | null;
    error: string | null;
    submitJob: (modelFile: File, modifications?: Modification[], presetData?: Record<string, unknown>) => Promise<void>;
    downloadUrl: string | null;
    reset: () => void;
}

export function useSlicerJob(): UseSlicerJobReturn {
    const [phase, setPhase] = useState<SlicerJobPhase>('idle');
    const [result, setResult] = useState<SlicerJobResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const jobIdRef = useRef<string | null>(null);

    const submitJob = useCallback(async (
        modelFile: File,
        modifications?: Modification[],
        presetData?: Record<string, unknown>,
    ) => {
        setPhase('uploading');
        setError(null);
        setResult(null);

        try {
            setPhase('processing');
            const jobResult = await api.submitSlicerJob(modelFile, {
                modifications,
                preset_data: presetData,
                auto_arrange: true,
                auto_orient: true,
                do_slice: false,
                output_format: '3mf',
            });

            jobIdRef.current = jobResult.job_id;

            if (jobResult.status === 'done') {
                setResult(jobResult);
                setPhase('done');
            } else if (jobResult.status === 'failed') {
                setError(jobResult.error || 'Processing failed');
                setPhase('error');
            } else {
                // Still processing — poll for completion
                setResult(jobResult);
                setPhase('processing');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setPhase('error');
        }
    }, []);

    const downloadUrl = result?.status === 'done' && result.job_id
        ? api.getSlicerDownloadUrl(result.job_id)
        : null;

    const reset = useCallback(() => {
        if (jobIdRef.current) {
            void api.cleanupSlicerJob(jobIdRef.current);
            jobIdRef.current = null;
        }
        setPhase('idle');
        setResult(null);
        setError(null);
    }, []);

    return { phase, result, error, submitJob, downloadUrl, reset };
}
