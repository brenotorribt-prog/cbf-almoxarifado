"use client"

import { createGlobalStyle } from "styled-components"
import { hexToRgba } from "@/styles/theme"

export const GlobalStyles = createGlobalStyle`
  /* ───────────────────────────────────────────────
   * Reset
   * ─────────────────────────────────────────────── */
  *,
  *::before,
  *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html {
    font-size: 16px;
    scroll-behavior: smooth;
    -webkit-text-size-adjust: 100%;
    overflow-x: hidden;
  }

  body {
    font-family: ${({ theme }) => theme.typography.fontFamily.sans};
    font-size: ${({ theme }) => theme.typography.fontSize.base};
    font-weight: ${({ theme }) => theme.typography.fontWeight.regular};
    line-height: ${({ theme }) => theme.typography.lineHeight.normal};

    color: ${({ theme }) => theme.colors.text.primary};

    background-color: ${({ theme }) => theme.colors.surface.background};

    background-image:
      radial-gradient(
        ellipse at 20% 0%,
        rgba(109, 191, 160, 0.06) 0%,
        transparent 50%
      ),
      radial-gradient(
        ellipse at 80% 100%,
        ${({ theme }) => hexToRgba(theme.colors.neutral[700], 0.08)} 0%,
        transparent 50%
      );

    background-repeat: no-repeat;
    background-size: cover;
    background-attachment: fixed;

    min-height: 100vh;

    overflow-x: hidden;

    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    color: ${({ theme }) => theme.colors.text.primary};
    font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
    line-height: ${({ theme }) => theme.typography.lineHeight.tight};
  }

  h1 {
    font-size: ${({ theme }) => theme.typography.fontSize["4xl"]};
  }

  h2 {
    font-size: ${({ theme }) => theme.typography.fontSize["3xl"]};
  }

  h3 {
    font-size: ${({ theme }) => theme.typography.fontSize["2xl"]};
  }

  h4 {
    font-size: ${({ theme }) => theme.typography.fontSize.xl};
  }

  h5 {
    font-size: ${({ theme }) => theme.typography.fontSize.lg};
  }

  h6 {
    font-size: ${({ theme }) => theme.typography.fontSize.base};
  }

  p {
    color: ${({ theme }) => theme.colors.text.secondary};
    line-height: ${({ theme }) => theme.typography.lineHeight.relaxed};
  }

  a {
    color: ${({ theme }) => theme.colors.text.link};
    text-decoration: none;
    transition: color ${({ theme }) => theme.transitions.fast};

    &:hover {
      color: ${({ theme }) => theme.colors.text.linkHover};
    }
  }

  button {
    border: none;
    background: none;
    cursor: pointer;

    font: inherit;

    transition: all ${({ theme }) => theme.transitions.base};

    &:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }
  }

  input,
  textarea,
  select {
    border: none;
    outline: none;

    font: inherit;

    &::placeholder {
      color: ${({ theme }) => theme.colors.text.muted};
    }
  }

  ul,
  ol {
    list-style: none;
  }

  img,
  svg {
    display: block;
    max-width: 100%;
  }

  code,
  pre {
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
    font-size: ${({ theme }) => theme.typography.fontSize.sm};
  }

  /* Scrollbar */

  ::-webkit-scrollbar {
    width: 5px;
    height: 5px;
  }

  ::-webkit-scrollbar-track {
    background: ${({ theme }) => theme.colors.surface.glass};
  }

  ::-webkit-scrollbar-thumb {
    background: rgba(109,191,160,.2);
    border-radius: ${({ theme }) => theme.radii.full};

    &:hover {
      background: rgba(109,191,160,.4);
    }
  }

  /* Seleção */

  ::selection {
    background: rgba(109,191,160,.25);
    color: ${({ theme }) => theme.colors.neutral.white};
  }

  /* Focus */

  :focus-visible {
    outline: 2px solid rgba(109,191,160,.6);
    outline-offset: 2px;
    border-radius: ${({ theme }) => theme.radii.sm};
  }

  /* Utilitários */

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;

    margin: -1px;
    padding: 0;

    overflow: hidden;

    white-space: nowrap;

    clip: rect(0,0,0,0);

    border: 0;
  }

  .truncate {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
`