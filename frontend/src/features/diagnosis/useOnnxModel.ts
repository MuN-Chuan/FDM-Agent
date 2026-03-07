import { useState, useEffect, useCallback } from 'react';

// ort is loaded as a plain <script> tag in index.html to bypass Vite/esbuild
// which would break WebAssembly bindings if it processes the onnxruntime-web package.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const ort: any;

export interface InferenceResult {
    classIndex: number;
    className: string;
    probability: number;
}

const CLASSES = [
    'first_layer_good', 'first_layer_high', 'first_layer_low', 'good',
    'over_extrusion', 'print_detached', 'spaghetti', 'stringing',
    'under_extrusion', 'warping', 'z_seam', 'z_wobble',
    'clogged_nozzle', 'inconsistent_extrusion', 'missing_layers'
];

export const useOnnxModel = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [session, setSession] = useState<any>(null);
    const [isModelReady, setIsModelReady] = useState(false);
    const [isInferencing, setIsInferencing] = useState(false);
    const [modelError, setModelError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;

        const initModel = async () => {
            try {
                // Configure WASM paths to point to public/ort/
                ort.env.wasm.wasmPaths = '/ort/';
                ort.env.wasm.numThreads = 4; // Enable multi-threading

                const newSession = await ort.InferenceSession.create('/models/kaggle-640.onnx');

                if (mounted) {
                    setSession(newSession);
                    setIsModelReady(true);
                } else {
                    newSession.release();
                }
            } catch (err: any) {
                console.error("Failed to load ONNX model:", err);
                if (mounted) {
                    setModelError(err.message || 'Unknown error');
                }
            }
        };

        initModel();

        return () => {
            mounted = false;
        };
    }, []);

    const runInference = useCallback(async (imageFile: File): Promise<InferenceResult[] | null> => {
        if (!session) return null;

        setIsInferencing(true);
        setModelError(null);

        try {
            // Load image
            const img = new Image();
            img.src = URL.createObjectURL(imageFile);
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
            });

            const targetSize = 640;
            const targetWidth = targetSize;
            const targetHeight = targetSize;

            const offscreen = document.createElement('canvas');
            offscreen.width = targetWidth;
            offscreen.height = targetHeight;
            const offCtx = offscreen.getContext('2d');
            if (!offCtx) throw new Error("Could not get 2D context");

            // Letterbox preprocessing for 640px model
            const scale = Math.min(targetWidth / img.width, targetHeight / img.height);
            const w = img.width * scale;
            const h = img.height * scale;
            const x = (targetWidth - w) / 2;
            const y = (targetHeight - h) / 2;

            offCtx.fillStyle = '#727272';
            offCtx.fillRect(0, 0, targetWidth, targetHeight);
            offCtx.drawImage(img, x, y, w, h);

            const imageData = offCtx.getImageData(0, 0, targetWidth, targetHeight);
            const { data } = imageData;

            const float32Data = new Float32Array(3 * targetWidth * targetHeight);
            for (let i = 0; i < targetWidth * targetHeight; i++) {
                float32Data[i] = data[i * 4] / 255.0; // R
                float32Data[i + targetWidth * targetHeight] = data[i * 4 + 1] / 255.0; // G
                float32Data[i + 2 * targetWidth * targetHeight] = data[i * 4 + 2] / 255.0; // B
            }

            const inputTensor = new ort.Tensor('float32', float32Data, [1, 3, targetHeight, targetWidth]);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const feeds: Record<string, any> = {};
            feeds[session.inputNames[0]] = inputTensor;

            const outputData = await session.run(feeds);
            const output = outputData[session.outputNames[0]].data;

            // Softmax
            const expValues = Array.from(output as Float32Array).map(v => Math.exp(v as number));
            const sumExp = expValues.reduce((a, b) => a + b, 0);
            const probs = expValues.map(v => v / sumExp);

            // Format results
            const results = probs.map((prob, index) => ({
                classIndex: index,
                className: CLASSES[index] || `class_${index}`,
                probability: prob
            })).sort((a, b) => b.probability - a.probability);

            setIsInferencing(false);
            return results;

        } catch (err: any) {
            console.error("Inference Error:", err);
            setModelError(err.message || 'Inference failed');
            setIsInferencing(false);
            return null;
        }
    }, [session]);

    return { isModelReady, isInferencing, modelError, runInference };
};
