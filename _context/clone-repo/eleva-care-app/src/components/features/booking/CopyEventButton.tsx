'use client';

import { Button, type ButtonProps } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CopyCheck, CopyX, Link2 } from 'lucide-react';
import { useState } from 'react';

type CopyState = 'idle' | 'copied' | 'error';

export function CopyEventButton({
  eventSlug,
  username,
  wrapped = false,
  ...buttonProps
}: Omit<ButtonProps, 'children' | 'onClick'> & {
  eventSlug: string;
  username: string;
  wrapped?: boolean;
}) {
  const [copyState, setCopyState] = useState<CopyState>('idle');

  const tooltipContent = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          {...buttonProps}
          onClick={() => {
            navigator.clipboard
              .writeText(`${location.origin}/${username}/${eventSlug}`)
              .then(() => {
                setCopyState('copied');
                setTimeout(() => setCopyState('idle'), 2000);
              })
              .catch(() => {
                setCopyState('error');
                setTimeout(() => setCopyState('idle'), 2000);
              });
          }}
        >
          {copyState === 'copied' ? (
            <CopyCheck className="h-4 w-4" />
          ) : copyState === 'error' ? (
            <CopyX className="h-4 w-4" />
          ) : (
            <Link2 className="h-4 w-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>
          {copyState === 'copied'
            ? 'Link copied!'
            : copyState === 'error'
              ? 'Failed to copy'
              : 'Copy event link'}
        </p>
      </TooltipContent>
    </Tooltip>
  );

  return wrapped ? tooltipContent : <TooltipProvider>{tooltipContent}</TooltipProvider>;
}
