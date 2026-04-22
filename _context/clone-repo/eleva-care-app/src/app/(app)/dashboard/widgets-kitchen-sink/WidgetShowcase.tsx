'use client';

/**
 * WorkOS Widgets Showcase Component
 *
 * Client component that renders WorkOS widgets with their documentation.
 * Organized by category with collapsible sections.
 */
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Theme } from '@radix-ui/themes';
import {
  AdminPortalDomainVerification,
  AdminPortalSsoConnection,
  ApiKeys,
  UserProfile,
  UserSecurity,
  UserSessions,
  UsersManagement,
  WorkOsWidgets,
} from '@workos-inc/widgets';
import { AlertCircle, Globe, Key, Monitor, Settings, Shield, Users } from 'lucide-react';
import { useState } from 'react';

interface Widget {
  id: string;
  name: string;
  description: string;
  category: string;
  token: string;
  scopes: string[];
  useCases: string[];
  permissions: string;
  component: string;
  sessionId?: string;
}

interface WidgetShowcaseProps {
  widgets: Widget[];
}

const categoryIcons: Record<string, React.ReactNode> = {
  'User Management': <Users className="h-5 w-5" />,
  Security: <Shield className="h-5 w-5" />,
  'Developer Tools': <Key className="h-5 w-5" />,
  'Admin Portal': <Settings className="h-5 w-5" />,
};

const categoryColors: Record<string, string> = {
  'User Management': 'bg-blue-500/10 text-blue-500',
  Security: 'bg-red-500/10 text-red-500',
  'Developer Tools': 'bg-purple-500/10 text-purple-500',
  'Admin Portal': 'bg-orange-500/10 text-orange-500',
};

export function WidgetShowcase({ widgets }: WidgetShowcaseProps) {
  const [viewMode, setViewMode] = useState<'list' | 'live'>('live'); // Default to live view

  // Group widgets by category
  const widgetsByCategory = widgets.reduce(
    (acc, widget) => {
      if (!acc[widget.category]) {
        acc[widget.category] = [];
      }
      acc[widget.category].push(widget);
      return acc;
    },
    {} as Record<string, Widget[]>,
  );

  // Render the appropriate widget component
  const renderWidget = (widget: Widget) => {
    // authToken is the widget token string (WorkOS widgets v1.6+)
    const commonProps = {
      authToken: widget.token,
    };

    switch (widget.component) {
      case 'UsersManagement':
        return <UsersManagement {...commonProps} />;
      case 'UserProfile':
        return <UserProfile {...commonProps} />;
      case 'UserSecurity':
        return <UserSecurity {...commonProps} />;
      case 'UserSessions':
        return <UserSessions {...commonProps} currentSessionId={widget.sessionId || ''} />;
      case 'ApiKeys':
        return <ApiKeys {...commonProps} />;
      case 'AdminPortalDomainVerification':
        return <AdminPortalDomainVerification {...commonProps} />;
      case 'AdminPortalSsoConnection':
        return <AdminPortalSsoConnection {...commonProps} />;
      default:
        return (
          <div className="text-muted-foreground">
            Widget component not implemented: {widget.component}
          </div>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* View Mode Toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Available Widgets</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('list')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              viewMode === 'list'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            📋 Overview
          </button>
          <button
            onClick={() => setViewMode('live')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              viewMode === 'live'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            🎨 Live Widgets
          </button>
        </div>
      </div>

      {/* List View - Widget Grid Overview */}
      {viewMode === 'list' && (
        <div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {widgets.map((widget) => (
              <Card
                key={widget.id}
                className="cursor-pointer transition-shadow hover:shadow-lg"
                onClick={() => {
                  setViewMode('live');
                }}
              >
                <CardHeader>
                  <div className="mb-2 flex items-center justify-between">
                    <Badge className={categoryColors[widget.category]}>{widget.category}</Badge>
                    {categoryIcons[widget.category]}
                  </div>
                  <CardTitle className="text-lg">{widget.name}</CardTitle>
                  <CardDescription className="text-sm">{widget.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">Permissions:</span>
                      <p className="mt-1 text-xs text-muted-foreground">{widget.permissions}</p>
                    </div>
                    <div>
                      <span className="font-medium">Scopes:</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {widget.scopes.map((scope) => (
                          <code key={scope} className="rounded bg-muted px-2 py-1 text-xs">
                            {scope}
                          </code>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Live View - Interactive Widgets */}
      {viewMode === 'live' && (
        <div>
          <Accordion
            type="multiple"
            className="space-y-4"
            defaultValue={widgets.map((w) => w.id)} // Open all by default
          >
            {Object.entries(widgetsByCategory).map(([category, categoryWidgets]) => (
              <div key={category} className="space-y-4">
                <h3 className="flex items-center gap-2 text-xl font-semibold">
                  {categoryIcons[category]}
                  {category}
                </h3>

                {categoryWidgets.map((widget) => (
                  <AccordionItem key={widget.id} value={widget.id} className="rounded-lg border">
                    <AccordionTrigger className="px-4 hover:no-underline">
                      <div className="flex items-center gap-3 text-left">
                        <Badge className={categoryColors[widget.category]}>{widget.category}</Badge>
                        <span className="font-semibold">{widget.name}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-4">
                        {/* Description */}
                        <div>
                          <h4 className="mb-2 font-medium">Description</h4>
                          <p className="text-sm text-muted-foreground">{widget.description}</p>
                        </div>

                        {/* Use Cases */}
                        <div>
                          <h4 className="mb-2 font-medium">Use Cases</h4>
                          <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                            {widget.useCases.map((useCase) => (
                              <li key={useCase}>{useCase}</li>
                            ))}
                          </ul>
                        </div>

                        {/* Technical Details */}
                        <div className="grid grid-cols-1 gap-4 rounded-lg bg-muted p-3 md:grid-cols-2">
                          <div>
                            <h5 className="mb-1 text-sm font-medium">Required Scopes</h5>
                            <div className="flex flex-wrap gap-1">
                              {widget.scopes.map((scope) => (
                                <code
                                  key={scope}
                                  className="rounded bg-background px-2 py-1 text-xs"
                                >
                                  {scope}
                                </code>
                              ))}
                            </div>
                          </div>
                          <div>
                            <h5 className="mb-1 text-sm font-medium">Permissions</h5>
                            <p className="text-xs text-muted-foreground">{widget.permissions}</p>
                          </div>
                        </div>

                        {/* Live Widget */}
                        <div>
                          <h4 className="mb-2 flex items-center gap-2 font-medium">
                            <Monitor className="h-4 w-4" />
                            Live Widget
                          </h4>
                          <div className="rounded-lg border bg-background p-4">
                            <WorkOsWidgets>
                              <Theme appearance="light" accentColor="blue">
                                {renderWidget(widget)}
                              </Theme>
                            </WorkOsWidgets>
                          </div>
                        </div>

                        {/* Implementation Example */}
                        <div>
                          <h4 className="mb-2 font-medium">Implementation Example</h4>
                          <pre className="overflow-auto rounded-lg bg-muted p-4 text-xs">
                            <code>{`import { ${widget.component}, WorkOsWidgets } from '@workos-inc/widgets';

export function ${widget.name.replace(/\s+/g, '')}Page({ authToken${widget.sessionId ? ', currentSessionId' : ''} }) {
  return (
    <WorkOsWidgets>
      <${widget.component}
        authToken={async () => authToken} // Must be an async function!${widget.sessionId ? '\n        currentSessionId={currentSessionId}' : ''}
      />
    </WorkOsWidgets>
  );
}`}</code>
                          </pre>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </div>
            ))}
          </Accordion>
        </div>
      )}

      {/* Documentation Link */}
      <div className="mt-8 rounded-lg border bg-muted p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 text-blue-500" />
          <div>
            <h3 className="mb-1 font-semibold">WorkOS Widgets Documentation</h3>
            <p className="mb-2 text-sm text-muted-foreground">
              For complete documentation, styling options, and advanced usage, visit the official
              WorkOS Widgets documentation.
            </p>
            <a
              href="https://workos.com/docs/widgets/quick-start"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <Globe className="h-4 w-4" />
              View Official Documentation →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
