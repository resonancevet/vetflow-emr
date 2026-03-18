"use client";

import { useState, useMemo } from "react";
import {
  Mail,
  MessageSquare,
  Phone,
  Globe,
  Send,
  ArrowLeft,
  ArrowRight,
  Clock,
  Circle,
  Plus,
  Search,
  Inbox as InboxIcon,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type FilterTab = "all" | "unread" | "sent";
type Channel = "phone" | "sms" | "email" | "portal";

const channelIcons: Record<Channel, React.ElementType> = {
  phone: Phone,
  sms: MessageSquare,
  email: Mail,
  portal: Globe,
};

const channelLabels: Record<Channel, string> = {
  phone: "Phone",
  sms: "SMS",
  email: "Email",
  portal: "Portal",
};

function relativeTime(date: Date | string | null): string {
  if (!date) return "";
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString();
}

export default function InboxPage() {
  const [filter, setFilter] = useState<FilterTab>("all");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedClientName, setSelectedClientName] = useState<string>("");
  const [composing, setComposing] = useState(false);
  const [clientSearch, setClientSearch] = useState("");

  // Compose form state
  const [composeChannel, setComposeChannel] = useState<Channel>("email");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeContent, setComposeContent] = useState("");

  // New message client picker
  const [newMessageMode, setNewMessageMode] = useState(false);
  const [newClientSearch, setNewClientSearch] = useState("");

  const statusFilter = useMemo(() => {
    if (filter === "unread") return "delivered";
    if (filter === "sent") return "sent";
    return undefined;
  }, [filter]);

  const { data: commsData, isLoading } = trpc.communications.list.useQuery(
    { status: statusFilter, limit: 50, offset: 0 },
    { refetchInterval: 30000 }
  );

  const { data: timeline, isLoading: timelineLoading } =
    trpc.communications.getByClient.useQuery(
      { clientId: selectedClientId! },
      { enabled: !!selectedClientId }
    );

  const { data: searchResults } = trpc.clients.search.useQuery(
    { query: newClientSearch },
    { enabled: newClientSearch.length >= 1 }
  );

  const utils = trpc.useUtils();

  const createMutation = trpc.communications.create.useMutation({
    onSuccess: () => {
      utils.communications.list.invalidate();
      if (selectedClientId) {
        utils.communications.getByClient.invalidate({
          clientId: selectedClientId,
        });
      }
      setComposeContent("");
      setComposeSubject("");
    },
  });

  // Group communications by client for list view
  const groupedByClient = useMemo(() => {
    if (!commsData?.items) return [];
    const map = new Map<
      string,
      {
        clientId: string;
        clientName: string;
        latest: (typeof commsData.items)[0];
        unreadCount: number;
      }
    >();

    for (const item of commsData.items) {
      const cid = item.clientId ?? "unknown";
      const existing = map.get(cid);
      if (!existing) {
        map.set(cid, {
          clientId: cid,
          clientName:
            item.clientFirstName && item.clientLastName
              ? `${item.clientFirstName} ${item.clientLastName}`
              : "Unknown Client",
          latest: item,
          unreadCount: item.status !== "read" ? 1 : 0,
        });
      } else {
        if (item.status !== "read") existing.unreadCount++;
      }
    }

    return Array.from(map.values());
  }, [commsData]);

  function handleSelectClient(clientId: string, clientName: string) {
    setSelectedClientId(clientId);
    setSelectedClientName(clientName);
    setNewMessageMode(false);
  }

  function handleSend() {
    if (!selectedClientId || !composeContent.trim()) return;
    createMutation.mutate({
      clientId: selectedClientId,
      channel: composeChannel,
      direction: "outbound",
      subject: composeChannel === "email" ? composeSubject : undefined,
      content: composeContent,
    });
  }

  function handleNewMessage() {
    setNewMessageMode(true);
    setSelectedClientId(null);
    setNewClientSearch("");
  }

  const filterTabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "unread", label: "Unread" },
    { key: "sent", label: "Sent" },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-heading text-xl font-semibold">Inbox</h2>
          <p className="text-sm text-muted-foreground">
            Client communications
          </p>
        </div>
        <Button onClick={handleNewMessage} className="gap-2">
          <Plus className="h-4 w-4" />
          New Message
        </Button>
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-1 rounded-lg border border-border bg-card overflow-hidden min-h-0">
        {/* Left panel - list */}
        <div className="w-80 border-r border-border flex flex-col shrink-0">
          {/* Filter tabs */}
          <div className="flex border-b border-border">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={cn(
                  "flex-1 px-3 py-2.5 text-sm font-medium transition-colors",
                  filter === tab.key
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Communication list */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Loading...
              </div>
            ) : groupedByClient.length === 0 ? (
              <div className="p-8 text-center">
                <InboxIcon className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">
                  No messages yet
                </p>
              </div>
            ) : (
              groupedByClient.map((group) => {
                const Icon = channelIcons[group.latest.channel as Channel];
                const isSelected = selectedClientId === group.clientId;
                const isUnread = group.unreadCount > 0;
                const preview =
                  group.latest.subject ||
                  group.latest.content?.slice(0, 60) ||
                  "No content";

                return (
                  <button
                    key={group.clientId}
                    onClick={() =>
                      handleSelectClient(group.clientId, group.clientName)
                    }
                    className={cn(
                      "w-full text-left px-4 py-3 border-b border-border transition-colors",
                      isSelected
                        ? "bg-accent"
                        : "hover:bg-accent/50"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {/* Unread indicator */}
                      <div className="mt-1.5 shrink-0">
                        {isUnread ? (
                          <Circle className="h-2.5 w-2.5 fill-primary text-primary" />
                        ) : (
                          <div className="h-2.5 w-2.5" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              "text-sm truncate",
                              isUnread ? "font-semibold" : "font-medium"
                            )}
                          >
                            {group.clientName}
                          </span>
                          <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                            <Icon className="h-3 w-3" />
                            <span className="text-xs">
                              {relativeTime(group.latest.createdAt)}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {preview.length > 60
                            ? preview.slice(0, 60) + "..."
                            : preview}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right panel - detail/compose */}
        <div className="flex-1 flex flex-col min-w-0">
          {newMessageMode ? (
            /* New message - client search */
            <div className="flex-1 flex flex-col">
              <div className="p-4 border-b border-border">
                <h3 className="font-medium text-sm mb-2">New Message</h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search clients..."
                    value={newClientSearch}
                    onChange={(e) => setNewClientSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {searchResults && searchResults.length > 0 ? (
                  searchResults.map((client) => (
                    <button
                      key={client.id}
                      onClick={() =>
                        handleSelectClient(
                          client.id,
                          `${client.firstName} ${client.lastName}`
                        )
                      }
                      className="w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors"
                    >
                      <div className="text-sm font-medium">
                        {client.firstName} {client.lastName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {client.email || client.phone || "No contact info"}
                      </div>
                    </button>
                  ))
                ) : newClientSearch.length >= 1 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No clients found
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Type to search for a client
                  </p>
                )}
              </div>
            </div>
          ) : selectedClientId ? (
            /* Conversation timeline */
            <div className="flex-1 flex flex-col min-h-0">
              {/* Conversation header */}
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <button
                  onClick={() => setSelectedClientId(null)}
                  className="lg:hidden p-1 hover:bg-accent rounded"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <h3 className="font-medium text-sm">{selectedClientName}</h3>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {timelineLoading ? (
                  <div className="text-center text-sm text-muted-foreground py-8">
                    Loading...
                  </div>
                ) : timeline && timeline.length > 0 ? (
                  [...timeline].reverse().map((msg) => {
                    const Icon = channelIcons[msg.channel as Channel];
                    const isOutbound = msg.direction === "outbound";

                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex gap-2",
                          isOutbound ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[70%] rounded-lg px-3 py-2",
                            isOutbound
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          )}
                        >
                          {/* Direction + channel */}
                          <div
                            className={cn(
                              "flex items-center gap-1.5 mb-1",
                              isOutbound
                                ? "text-primary-foreground/70"
                                : "text-muted-foreground"
                            )}
                          >
                            {isOutbound ? (
                              <ArrowRight className="h-3 w-3" />
                            ) : (
                              <ArrowLeft className="h-3 w-3" />
                            )}
                            <Icon className="h-3 w-3" />
                            <span className="text-[10px] uppercase font-medium">
                              {channelLabels[msg.channel as Channel]}
                            </span>
                          </div>

                          {msg.subject && (
                            <p
                              className={cn(
                                "text-xs font-semibold mb-0.5",
                                isOutbound
                                  ? "text-primary-foreground/90"
                                  : "text-foreground"
                              )}
                            >
                              {msg.subject}
                            </p>
                          )}

                          <p className="text-sm whitespace-pre-wrap">
                            {msg.content}
                          </p>

                          <div
                            className={cn(
                              "flex items-center gap-1 mt-1",
                              isOutbound
                                ? "text-primary-foreground/50"
                                : "text-muted-foreground"
                            )}
                          >
                            <Clock className="h-2.5 w-2.5" />
                            <span className="text-[10px]">
                              {relativeTime(msg.createdAt)}
                            </span>
                            {msg.status && (
                              <span className="text-[10px] ml-1 capitalize">
                                {msg.status}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center text-sm text-muted-foreground py-8">
                    No messages with this client yet
                  </div>
                )}
              </div>

              {/* Compose area */}
              <div className="border-t border-border p-3 space-y-2">
                <div className="flex gap-2">
                  <select
                    value={composeChannel}
                    onChange={(e) =>
                      setComposeChannel(e.target.value as Channel)
                    }
                    className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  >
                    <option value="sms">SMS</option>
                    <option value="email">Email</option>
                    <option value="portal">Portal Message</option>
                  </select>

                  {composeChannel === "email" && (
                    <Input
                      placeholder="Subject"
                      value={composeSubject}
                      onChange={(e) => setComposeSubject(e.target.value)}
                      className="flex-1"
                    />
                  )}
                </div>

                <div className="flex gap-2">
                  <textarea
                    placeholder="Type a message..."
                    value={composeContent}
                    onChange={(e) => setComposeContent(e.target.value)}
                    rows={2}
                    className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={
                      !composeContent.trim() || createMutation.isPending
                    }
                    size="sm"
                    className="self-end gap-1"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Send
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* Empty state */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <InboxIcon className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">
                  No messages yet. Send your first message to a client.
                </p>
                <Button
                  variant="outline"
                  onClick={handleNewMessage}
                  className="mt-4 gap-2"
                >
                  <Plus className="h-4 w-4" />
                  New Message
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
