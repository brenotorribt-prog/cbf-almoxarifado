"use client"

import styled from "styled-components"

export default function Home() {
  return (
    <Container>
      <Card>
        <Title>CBF Almoxarifado</Title>
        <Description>
          Sistema interno de controle de estoque.
        </Description>
      </Card>
    </Container>
  )
}

const Container = styled.main`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;

  background: ${({ theme }) => theme.colors.surface.background};
  padding: ${({ theme }) => theme.spacing[8]};
`

const Card = styled.section`
  width: 100%;
  max-width: 600px;

  padding: ${({ theme }) => theme.spacing[8]};
  border-radius: ${({ theme }) => theme.radii.xl};

  background: ${({ theme }) => theme.colors.surface.card};
  border: 1px solid ${({ theme }) => theme.colors.surface.border};
  box-shadow: ${({ theme }) => theme.shadows.card};

  text-align: center;
`

const Title = styled.h1`
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: ${({ theme }) => theme.typography.fontSize["3xl"]};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
`

const Description = styled.p`
  margin-top: ${({ theme }) => theme.spacing[4]};

  color: ${({ theme }) => theme.colors.text.secondary};
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
`