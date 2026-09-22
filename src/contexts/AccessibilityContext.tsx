import React, { createContext, useContext, useState, useEffect } from 'react';

type FontSize = 'normal' | 'large' | 'extra-large';
type Contrast = 'normal' | 'high' | 'soft';
type Spacing = 'normal' | 'relaxed' | 'wide';

interface AccessibilityContextType {
  fontSize: FontSize;
  contrast: Contrast;
  spacing: Spacing;
  focusMode: boolean;
  setFontSize: (size: FontSize) => void;
  setContrast: (contrast: Contrast) => void;
  setSpacing: (spacing: Spacing) => void;
  setFocusMode: (active: boolean) => void;
  resetSettings: () => void;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [fontSize, setFontSize] = useState<FontSize>(() => 
    (localStorage.getItem('acc-font-size') as FontSize) || 'normal'
  );
  const [contrast, setContrast] = useState<Contrast>(() => 
    (localStorage.getItem('acc-contrast') as Contrast) || 'normal'
  );
  const [spacing, setSpacing] = useState<Spacing>(() => 
    (localStorage.getItem('acc-spacing') as Spacing) || 'normal'
  );
  const [focusMode, setFocusMode] = useState<boolean>(() => 
    localStorage.getItem('acc-focus-mode') === 'true'
  );

  useEffect(() => {
    localStorage.setItem('acc-font-size', fontSize);
    localStorage.setItem('acc-contrast', contrast);
    localStorage.setItem('acc-spacing', spacing);
    localStorage.setItem('acc-focus-mode', focusMode.toString());

    // Apply classes to root element
    const root = document.documentElement;
    root.classList.remove(
      'font-size-normal', 'font-size-large', 'font-size-extra-large',
      'contrast-normal', 'contrast-high', 'contrast-soft',
      'spacing-normal', 'spacing-relaxed', 'spacing-wide',
      'focus-mode-active'
    );
    
    root.classList.add(`font-size-${fontSize}`);
    root.classList.add(`contrast-${contrast}`);
    root.classList.add(`spacing-${spacing}`);
    if (focusMode) root.classList.add('focus-mode-active');
  }, [fontSize, contrast, spacing, focusMode]);

  const resetSettings = () => {
    setFontSize('normal');
    setContrast('normal');
    setSpacing('normal');
    setFocusMode(false);
  };

  return (
    <AccessibilityContext.Provider value={{ 
      fontSize, contrast, spacing, focusMode,
      setFontSize, setContrast, setSpacing, setFocusMode,
      resetSettings 
    }}>
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (context === undefined) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
};
