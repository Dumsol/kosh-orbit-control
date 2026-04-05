// Este arquivo é apenas documentação para o .NET/C#
// O SDK TypeScript não roda em .NET — use o cliente HTTP abaixo

/*
═══════════════════════════════════════════════════════════
  KoshLogger.cs — Cole na pasta /Services do projeto .NET
═══════════════════════════════════════════════════════════

using System.Text;
using System.Text.Json;

public class KoshLogger
{
    private readonly HttpClient _http;
    private readonly string _ingestUrl;
    private readonly string _token;
    private readonly string _project;
    private readonly string _env;

    public KoshLogger(IConfiguration config, HttpClient http)
    {
        _http      = http;
        _ingestUrl = config["Logger:IngestUrl"]!;
        _token     = config["Logger:Token"]!;
        _project   = config["Logger:Project"]!;
        _env       = "dotnet";
    }

    public void Log(string service, string level, string eventName,
                    string message, string? traceId = null,
                    object? metadata = null)
    {
        var payload = new
        {
            project    = _project,
            service,
            level,
            @event     = eventName,
            message,
            trace_id   = traceId ?? Guid.NewGuid().ToString(),
            env        = _env,
            created_at = DateTime.UtcNow.ToString("O"),
            metadata
        };

        var json    = JsonSerializer.Serialize(payload);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        _http.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _token);

        // Fire and forget — não bloqueia
        _ = _http.PostAsync(_ingestUrl, content);
    }
}

// ─── appsettings.json ────────────────────────────────────
// "Logger": {
//   "IngestUrl": "https://ingest.cspfood.com.br/ingest",
//   "Token":     "SEU_LOG_INGEST_TOKEN",
//   "Project":   "fiscal-worker"
// }

// ─── Program.cs ──────────────────────────────────────────
// builder.Services.AddHttpClient<KoshLogger>();

// ─── Uso no Worker ───────────────────────────────────────
// _logger.Log("fiscal-worker", "INFO", "nfe.transmitted",
//             "NF-e transmitida com sucesso",
//             metadata: new { chave = nfe.Chave });
*/

export {}  // mantém o arquivo como módulo TypeScript válido
