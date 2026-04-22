'use client';

import { useDocsSearch } from 'fumadocs-core/search/client';
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogFooter,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
  TagsList,
  TagsListItem,
  type SharedProps,
} from 'fumadocs-ui/components/dialog/search';
import { BookOpen, Building2, Users } from 'lucide-react';
import { useState } from 'react';

/**
 * Custom Search Dialog with Portal Tag Filtering
 *
 * Provides search across all help center portals with optional filtering.
 * Uses Orama search engine via the /api/search endpoint.
 *
 * Tags:
 * - patient: Patient Help Center
 * - expert: Expert Resources
 * - workspace: Workspace Portal
 *
 * @example
 * ```tsx
 * import HelpSearchDialog from './search-dialog';
 *
 * <RootProvider search={{ SearchDialog: HelpSearchDialog }}>
 *   {children}
 * </RootProvider>
 * ```
 *
 * @see https://fumadocs.vercel.app/docs/search/orama
 */
export default function HelpSearchDialog(props: SharedProps) {
  const [tag, setTag] = useState<string | undefined>();

  const { search, setSearch, query } = useDocsSearch({
    type: 'fetch',
    tag,
  });

  return (
    <SearchDialog
      search={search}
      onSearchChange={setSearch}
      isLoading={query.isLoading}
      {...props}
    >
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput placeholder="Search help center..." />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList items={query.data !== 'empty' ? query.data : null} />
        <SearchDialogFooter className="flex flex-row items-center gap-2">
          <span className="text-fd-muted-foreground text-xs">Filter:</span>
          <TagsList tag={tag} onTagChange={setTag}>
            <TagsListItem value="patient" className="gap-1">
              <Users className="size-3" />
              Patient
            </TagsListItem>
            <TagsListItem value="expert" className="gap-1">
              <BookOpen className="size-3" />
              Expert
            </TagsListItem>
            <TagsListItem value="workspace" className="gap-1">
              <Building2 className="size-3" />
              Workspace
            </TagsListItem>
          </TagsList>
        </SearchDialogFooter>
      </SearchDialogContent>
    </SearchDialog>
  );
}

