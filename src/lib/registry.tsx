// src/lib/registry.tsx
"use client";

import React, { useState } from "react";
import { useServerInsertedHTML } from "next/navigation";
import {
  ServerStyleSheet,
  StyleSheetManager,
} from "styled-components";

interface Props {
  children: React.ReactNode;
}

export default function StyledComponentsRegistry({
  children,
}: Props) {
  const [sheet] = useState(() => new ServerStyleSheet());

  useServerInsertedHTML(() => {
    const styles = sheet.getStyleElement();
    sheet.instance.clearTag();
    return <>{styles}</>;
  });

  // No cliente o styled-components usa seu próprio sheet.
  if (typeof window !== "undefined") {
    return <>{children}</>;
  }

  // Apenas no SSR usamos o StyleSheetManager.
  return (
    <StyleSheetManager sheet={sheet.instance}>
      {children}
    </StyleSheetManager>
  );
}