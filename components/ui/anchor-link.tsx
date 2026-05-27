'use client'

import Link from 'next/link'
import { Anchor, type AnchorProps } from '@mantine/core'

type Props = AnchorProps & { href: string }

export function AnchorLink({ href, children, ...props }: Props) {
  return (
    <Anchor component={Link} href={href} {...props}>
      {children}
    </Anchor>
  )
}
