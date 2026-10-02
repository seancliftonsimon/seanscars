import { createContext, useContext } from 'react';

export type PaletteMode = 'search' | 'capture';
export const PaletteContext = createContext<(mode?: PaletteMode) => void>(() => undefined);
export const useOpenPalette = () => useContext(PaletteContext);
