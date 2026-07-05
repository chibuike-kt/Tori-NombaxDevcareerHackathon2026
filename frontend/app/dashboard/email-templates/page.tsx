"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getEmailTemplates,
  updateEmailTemplate,
  sendTestEmailTemplate,
  type EmailTemplateConfig,
} from "@/lib/api";

function EventCard({
  template,
  onOpen,
}: {
  template: EmailTemplateConfig;
  onOpen: () => void;
}) {
  const qc = useQueryClient();

  const toggleEnabled = useMutation({
    mutationFn: () =>
      updateEmailTemplate(template.event_type, {
        subject: template.subject,
        html_body: template.html_body,
        is_enabled: !template.is_enabled,
        use_default: template.use_default,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-templates"] }),
  });

  return (
    <div
      className="bg-white border rounded-xl p-5 cursor-pointer transition-all hover:shadow-md"
      style={{ borderColor: "#EAECEF" }}
      onClick={onOpen}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "#E6F8F2", color: "#00B37E" }}>
          <i className="ti ti-mail" style={{ fontSize: 18 }} />
        </div>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
          style={{
            background: template.use_default ? "#F1F3F5" : "#E6F8F2",
            color: template.use_default ? "#6B7280" : "#00B37E",
          }}
        >
          {template.use_default ? "Default" : "Custom"}
        </span>
      </div>
      <h3 className="text-sm font-extrabold mb-1" style={{ color: "#0F1728" }}>{template.label}</h3>
      <p className="text-xs font-medium mb-4" style={{ color: "#8A94A6" }}>{template.description}</p>
      <div className="flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
        <span className="text-xs font-semibold" style={{ color: template.is_enabled ? "#0A7A56" : "#9CA3AF" }}>
          {template.is_enabled ? "Enabled" : "Disabled"}
        </span>
        <button
          onClick={() => toggleEnabled.mutate()}
          disabled={toggleEnabled.isPending}
          className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
          style={{ background: template.is_enabled ? "#00B37E" : "#E5E7EB" }}
        >
          <span
            className="inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform"
            style={{ transform: template.is_enabled ? "translateX(18px)" : "translateX(3px)" }}
          />
        </button>
      </div>
    </div>
  );
}

function TemplatePanel({
  template,
  onClose,
}: {
  template: EmailTemplateConfig;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [useDefault, setUseDefault] = useState(template.use_default);
  const [subject, setSubject] = useState(template.subject);
  const [htmlBody, setHtmlBody] = useState(template.html_body);
  const [testSent, setTestSent] = useState(false);

  useEffect(() => {
    setUseDefault(template.use_default);
    setSubject(template.subject);
    setHtmlBody(template.html_body);
  }, [template]);

  // Default previews are always rendered by the backend from the built-in
  // template. Custom previews reflect whatever is currently being edited.
  const previewHTML = useDefault ? template.html_body : htmlBody;

  const save = useMutation({
    mutationFn: () =>
      updateEmailTemplate(template.event_type, {
        subject,
        html_body: htmlBody,
        is_enabled: template.is_enabled,
        use_default: useDefault,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-templates"] });
      onClose();
    },
  });

  const sendTest = useMutation({
    mutationFn: () => sendTestEmailTemplate(template.event_type),
    onSuccess: () => {
      setTestSent(true);
      setTimeout(() => setTestSent(false), 3000);
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(15,23,40,0.4)" }} onClick={onClose}>
      <div
        className="bg-white w-full max-w-lg h-full overflow-y-auto p-6"
        style={{ borderLeft: "1px solid #EAECEF" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-extrabold" style={{ color: "#0F1728" }}>{template.label}</h2>
          <button onClick={onClose} style={{ color: "#6B7280" }}>
            <i className="ti ti-x" style={{ fontSize: 20 }} />
          </button>
        </div>
        <p className="text-xs font-medium mb-6" style={{ color: "#8A94A6" }}>{template.description}</p>

        <div className="flex items-center rounded-lg p-1 gap-1 mb-5" style={{ background: "#F1F3F5" }}>
          <button
            onClick={() => setUseDefault(true)}
            className="flex-1 text-xs font-bold px-3 py-2 rounded-md"
            style={{ background: useDefault ? "#0F1728" : "transparent", color: useDefault ? "#fff" : "#6B7280" }}
          >
            Use default template
          </button>
          <button
            onClick={() => setUseDefault(false)}
            className="flex-1 text-xs font-bold px-3 py-2 rounded-md"
            style={{ background: !useDefault ? "#0F1728" : "transparent", color: !useDefault ? "#fff" : "#6B7280" }}
          >
            Customize
          </button>
        </div>

        {!useDefault && (
          <div className="space-y-3 mb-5">
            <div>
              <label className="text-xs font-semibold block mb-1.5" style={{ color: "#4B5563" }}>
                Subject
              </label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none font-medium"
                style={{ background: "#F8F9FA", color: "#0F1728" }}
              />
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1.5" style={{ color: "#4B5563" }}>
                HTML body
              </label>
              <textarea
                value={htmlBody}
                onChange={(e) => setHtmlBody(e.target.value)}
                rows={10}
                className="w-full rounded-lg px-3.5 py-2.5 text-xs font-mono outline-none"
                style={{ background: "#F8F9FA", color: "#0F1728" }}
              />
              <p className="text-[11px] font-medium mt-1" style={{ color: "#9CA3AF" }}>
                Variables: {"{{customer_email}}"} {"{{plan_name}}"} {"{{amount}}"} {"{{next_billing_date}}"} {"{{pay_link}}"} {"{{product_name}}"}
              </p>
            </div>
          </div>
        )}

        <div className="mb-5">
          <p className="text-xs font-semibold mb-2" style={{ color: "#4B5563" }}>
            Preview
          </p>
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#E5E7EB" }}>
            <iframe
              title="Email preview"
              srcDoc={useDefault ? template.subject === subject ? htmlBody : template.html_body : htmlBody}
              className="w-full"
              style={{ height: 320, border: "none" }}
            />
          </div>
        </div>

        {save.isError && (
          <p className="text-xs font-medium mb-3" style={{ color: "#DC2626" }}>
            {save.error instanceof Error ? save.error.message : "Failed to save"}
          </p>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="text-sm px-4 py-2.5 rounded-lg font-bold text-white"
            style={{ background: save.isPending ? "#9CA3AF" : "#0F1728" }}
          >
            {save.isPending ? "Saving..." : "Save"}
          </button>
          <button
            onClick={() => sendTest.mutate()}
            disabled={sendTest.isPending}
            className="text-sm px-4 py-2.5 rounded-lg font-bold border"
            style={{ borderColor: "#E5E7EB", color: testSent ? "#00B37E" : "#6B7280" }}
          >
            {sendTest.isPending ? "Sending..." : testSent ? "Sent!" : "Send test email"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EmailTemplatesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["email-templates"],
    queryFn: getEmailTemplates,
  });
  const [openEvent, setOpenEvent] = useState<string | null>(null);

  const templates = data?.data ?? [];
  const active = templates.find((t) => t.event_type === openEvent) ?? null;

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl lg:text-2xl font-extrabold" style={{ color: "#0F1728", letterSpacing: "-0.02em" }}>
          Email Templates
        </h1>
        <p className="text-sm font-medium mt-0.5" style={{ color: "#8A94A6" }}>
          Automated emails your customers receive at key billing events. Use the default or write your own.
        </p>
      </div>

      {isLoading ? (
        <div className="bg-white border rounded-xl p-12 text-center text-sm font-medium" style={{ borderColor: "#EAECEF", color: "#8A94A6" }}>
          Loading templates...
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <EventCard key={t.event_type} template={t} onOpen={() => setOpenEvent(t.event_type)} />
          ))}
        </div>
      )}

      {active && <TemplatePanel template={active} onClose={() => setOpenEvent(null)} />}
    </div>
  );
}
