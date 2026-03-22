import { useCallback, useRef, useState } from 'react';

import type { Modification, ThreeMFParseResult, ThreeMFModifyResponse } from '../../api/api';
import { api } from '../../api/api';

export type SlicerJobPhase = 'idle' | 'parsing' | 'wait_for_ai' | 'modifying' | 'done_repack' | 'done_cli' | 'error';

interface UseSlicerJobReturn {
    phase: SlicerJobPhase;
    parseResult: ThreeMFParseResult | null;
    modifyResult: ThreeMFModifyResponse | null;
    error: string | null;
    uploadAndParse: (file: File) => Promise<ThreeMFParseResult | undefined>;
    setExistingJob: (result: ThreeMFParseResult) => void;
    // Step 2: Apply AI modifications after they are generated
    applyModifications: (modifications: Modification[]) => Promise<void>;
    downloadUrl: string | null;
    reset: () => void;
}

export function useSlicerJob(): UseSlicerJobReturn {
    const [phase, setPhase] = useState<SlicerJobPhase>('idle');
    const [parseResult, setParseResult] = useState<ThreeMFParseResult | null>(null);
    const [modifyResult, setModifyResult] = useState<ThreeMFModifyResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    
    // Track job ID to allow cleanup or subsequent modification
    const jobIdRef = useRef<string | null>(null);

    const uploadAndParse = useCallback(async (file: File) => {
        setPhase('parsing');
        setError(null);
        setParseResult(null);
        setModifyResult(null);

        try {
            const result = await api.parse3MF(file);
            jobIdRef.current = result.job_id;
            setParseResult(result);
            setPhase('wait_for_ai');
            return result;
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setPhase('error');
            return undefined;
        }
    }, []);

    const setExistingJob = useCallback((result: ThreeMFParseResult) => {
        jobIdRef.current = result.job_id;
        setParseResult(result);
        setPhase('wait_for_ai');
    }, []);

    const applyModifications = useCallback(async (modifications: Modification[]) => {
        if (!jobIdRef.current) {
            setError('No active 3MF job found. Please upload a 3MF file first.');
            setPhase('error');
            return;
        }

        setPhase('modifying');
        setError(null);

        try {
            const result = await api.modify3MF({
                job_id: jobIdRef.current,
                modifications,
                repack_only: true // Inline python repack by default for now
            });
            
            setModifyResult(result);
            
            if (result.status === 'done') {
                setPhase('done_repack');
            } else if (result.status === 'pending_cli_repack') {
                setPhase('done_cli'); // Will be picked up by ClientAgentBridge later
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setPhase('error');
        }
    }, []);

    const downloadUrl = (phase === 'done_repack' && jobIdRef.current)
        ? api.getSlicer3mfDownloadUrl(jobIdRef.current)
        : null;

    const reset = useCallback(() => {
        if (jobIdRef.current) {
            // Optional cleanup if backend supports it
            jobIdRef.current = null;
        }
        setPhase('idle');
        setParseResult(null);
        setModifyResult(null);
        setError(null);
    }, []);

    return { 
        phase, 
        parseResult, 
        modifyResult, 
        error, 
        uploadAndParse, 
        setExistingJob,
        applyModifications, 
        downloadUrl, 
        reset 
    };
}
