import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

export type BodyLogSurfaceControls = {
	close: () => void;
	backToQuickLog: () => void;
};

export type BodyLogSurface = {
	closeAccessibilityLabel: string;
	render: (controls: BodyLogSurfaceControls) => ReactNode;
};

type BodyLogSurfaceContextValue = {
	surface: BodyLogSurface | null;
	register: (surface: BodyLogSurface) => void;
	unregister: () => void;
};

const BodyLogSurfaceContext = createContext<BodyLogSurfaceContextValue>({
	surface: null,
	register: () => undefined,
	unregister: () => undefined,
});

export function BodyLogSurfaceProvider({ children }: { children: ReactNode }) {
	const [surface, setSurface] = useState<BodyLogSurface | null>(null);
	const register = useCallback((nextSurface: BodyLogSurface) => {
		setSurface(nextSurface);
	}, []);
	const unregister = useCallback(() => setSurface(null), []);
	const value = useMemo(
		() => ({ surface, register, unregister }),
		[surface, register, unregister],
	);

	return (
		<BodyLogSurfaceContext.Provider value={value}>
			{children}
		</BodyLogSurfaceContext.Provider>
	);
}

export function useBodyLogSurface() {
	return useContext(BodyLogSurfaceContext);
}

export function useRegisterBodyLogSurface(surface: BodyLogSurface) {
	const { register, unregister } = useBodyLogSurface();

	// A block body, not a concise one: an effect that returns a value is read as
	// a cleanup function, and `register` returning something later would break
	// here rather than where it changed.
	useEffect(() => {
		register(surface);
	}, [register, surface]);
	useEffect(() => unregister, [unregister]);
}
