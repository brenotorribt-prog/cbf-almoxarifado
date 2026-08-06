"use client"

import { useTheme as useStyledTheme } from "styled-components"
import type { Theme } from "@/styles/theme"

export function useTheme(): Theme {
  return useStyledTheme()
}