import { Alert, Button, Card, Descriptions, Space, Typography } from "antd";
import { Home, LifeBuoy, ShieldOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fetchForbiddenContext, type ForbiddenContext } from "../api";

type TraceableError = Error & { traceId?: string };

function toTraceableError(error: unknown): TraceableError {
  if (error instanceof Error) {
    return error as TraceableError;
  }
  return new Error("无权限上下文加载失败");
}

export function ForbiddenPage() {
  const [searchParams] = useSearchParams();
  const [context, setContext] = useState<ForbiddenContext | null>(null);
  const [error, setError] = useState<TraceableError | null>(null);
  const [loading, setLoading] = useState(true);
  const fromPath = searchParams.get("from") || "/admin/dashboard";
  const reason = searchParams.get("reason") || "FORBIDDEN";
  const traceId = searchParams.get("trace_id") || undefined;
  const safeFromPath = useMemo(
    () => (fromPath.startsWith("/") && !fromPath.startsWith("//") ? fromPath : "/admin/dashboard"),
    [fromPath]
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchForbiddenContext({ from: safeFromPath, reason, traceId })
      .then((result) => {
        if (alive) {
          setContext(result);
          setError(null);
        }
      })
      .catch((failure) => {
        if (alive) setError(toTraceableError(failure));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [safeFromPath, reason, traceId]);

  const displayTraceId = context?.trace_id || traceId || error?.traceId || "--";
  const homePath = context?.default_home_path || "/admin/dashboard";

  return (
    <section className="forbidden-page" aria-labelledby="forbidden-title">
      <Card loading={loading} className="forbidden-card">
        <Space direction="vertical" size={20} style={{ width: "100%" }}>
          <div className="forbidden-icon" aria-hidden="true">
            <ShieldOff size={36} />
          </div>
          <div>
            <Typography.Text className="stage-label">阶段1(MVP) · 异常与权限</Typography.Text>
            <Typography.Title id="forbidden-title" level={2}>
              {context?.title || "无权限访问该页面"}
            </Typography.Title>
            <Typography.Paragraph className="muted">
              {context?.message || "当前账号没有执行该操作或查看该页面的权限。"}
            </Typography.Paragraph>
          </div>

          {error ? <Alert type="warning" showIcon message="无权限上下文加载失败" description={error.message} /> : null}

          <Descriptions bordered column={1} size="middle">
            <Descriptions.Item label="来源页面">{context?.from_path || safeFromPath}</Descriptions.Item>
            <Descriptions.Item label="原因代码">{context?.reason_code || reason}</Descriptions.Item>
            <Descriptions.Item label="当前角色">{context?.role || window.localStorage.getItem("ug_role") || "--"}</Descriptions.Item>
            <Descriptions.Item label="Trace ID">{displayTraceId}</Descriptions.Item>
            <Descriptions.Item label="处理建议">{context?.support_action || "联系管理员开通权限或重新分配负责人"}</Descriptions.Item>
          </Descriptions>

          <Space wrap>
            <Link to={homePath}>
              <Button type="primary" icon={<Home size={16} />}>
                回到工作台
              </Button>
            </Link>
            <Button
              icon={<LifeBuoy size={16} />}
              href={`mailto:admin@ultrasound-growth.local?subject=权限申请&body=Trace ID: ${displayTraceId}`}
            >
              联系管理员
            </Button>
          </Space>
        </Space>
      </Card>
    </section>
  );
}
