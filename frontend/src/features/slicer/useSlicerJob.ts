import { useCallback, useEffect, useRef, useState } from 'react';

import { api, type Modification, type ThreeMFModifyResponse, type ThreeMFParseResult } from '../../api/api';
import type { AgentMessage } from './ClientAgentBridge';

export type SlicerJobPhase =
    | 'idle'
    | 'parsing'
    | 'wait_for_ai'
    | 'modifying'
    | 'waiting_agent'
    | 'running_agent'
    | 'done_repack'
    | 'done_cli'
    | 'error';

interface UseSlicerJobOptions {
    agentConnected: boolean;
    agentMessage: AgentMessage | null;
    startAgentExport: (jobId: string) => boolean;
}

interface UseSlicerJobReturn {
    phase: SlicerJobPhase;
    parseResult: ThreeMFParseResult | null;
    modifyResult: ThreeMFModifyResponse | null;
    error: string | null;
    uploadAndParse: (file: File) => Promise<ThreeMFParseResult | undefined>;
    setExistingJob: (result: ThreeMFParseResult) => void;
    applyModifications: (modifications: Modification[]) => Promise<void>;
    downloadUrl: string | null;
    retryAgentExport: () => void;
    reset: () => void;
}

export function useSlicerJob({
    agentConnected,
    agentMessage,
    startAgentExport,
}: UseSlicerJobOptions): UseSlicerJobReturn {
    const [phase, setPhase] = useState<SlicerJobPhase>('idle');
    const [parseResult, setParseResult] = useState<ThreeMFParseResult | null>(null);
    const [modifyResult, setModifyResult] = useState<ThreeMFModifyResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

    const jobIdRef = useRef<string | null>(null);

    const uploadAndParse = useCallback(async (file: File) => {
        setPhase('parsing');
        setError(null);
        setParseResult(null);
        setModifyResult(null);
        setDownloadUrl(null);

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
        setError(null);
        setDownloadUrl(null);
    }, []);

    const retryAgentExport = useCallback(() => {
        if (!jobIdRef.current) {
            return;
        }

        if (startAgentExport(jobIdRef.current)) {
            setError(null);
            setPhase('running_agent');
        } else {
            setPhase('waiting_agent');
        }
    }, [startAgentExport]);

    const applyModifications = useCallback(async (modifications: Modification[]) => {
        if (!jobIdRef.current) {
            setError('No active 3MF job found. Please upload a 3MF file first.');
            setPhase('error');
            return;
        }

        setPhase('modifying');
        setError(null);
        setDownloadUrl(null);

        try {
            const result = await api.modify3MF({
                job_id: jobIdRef.current,
                modifications,
                repack_only: false,
            });

            setModifyResult(result);

            if (result.status === 'done') {
                setDownloadUrl(api.getSlicer3mfDownloadUrl(jobIdRef.current));
                setPhase('done_repack');
                return;
            }

            if (result.status === 'pending_agent_cli') {
                if (startAgentExport(jobIdRef.current)) {
                    setPhase('running_agent');
                } else {
                    setPhase('waiting_agent');
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setPhase('error');
        }
    }, [startAgentExport]);

    useEffect(() => {
        if (
            phase === 'waiting_agent' &&
            agentConnected &&
            jobIdRef.current &&
            modifyResult?.status === 'pending_agent_cli'
        ) {
            if (startAgentExport(jobIdRef.current)) {
                setError(null);
                setPhase('running_agent');
            }
        }
    }, [agentConnected, modifyResult, phase, startAgentExport]);

    useEffect(() => {
        const jobId = jobIdRef.current;
        if (!jobId || !agentMessage || agentMessage.job_id !== jobId) {
            return;
        }

        if (agentMessage.cmd && !['export_3mf_cli', 'repack_3mf'].includes(agentMessage.cmd)) {
            return;
        }

        if (agentMessage.type === 'progress') {
            setError(null);
            setPhase('running_agent');
            return;
        }

        if (agentMessage.type === 'done') {
            setError(null);
            setDownloadUrl(agentMessage.download_url ?? api.getSlicer3mfDownloadUrl(jobId));
            setPhase('done_cli');
            return;
        }

        if (agentMessage.type === 'error') {
            setError(agentMessage.message ?? 'Client Agent execution failed.');
            setPhase('error');
        }
    }, [agentMessage]);

    const reset = useCallback(() => {
        jobIdRef.current = null;
        setPhase('idle');
        setParseResult(null);
        setModifyResult(null);
        setDownloadUrl(null);
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
        retryAgentExport,
        reset,
    };
}
