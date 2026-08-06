"use client"

import styled from "styled-components"

const Wrapper = styled.div`
  padding: ${({ theme }) => theme.layout.contentPadding};
`

const Title = styled.h1`
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: ${({ theme }) => theme.typography.fontSize["3xl"]};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
`

export default function DashboardPage() {
  return (
    <Wrapper>
      <Title>Compras — em construção</Title>
    </Wrapper>
  )
}