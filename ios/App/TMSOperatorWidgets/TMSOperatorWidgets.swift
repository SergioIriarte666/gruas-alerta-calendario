import SwiftUI
import WidgetKit

private let appGroup = "group.cl.gruas5norte.tmsoperador"

private struct WidgetService {
    let folio: String
    let date: String
    let time: String
    let origin: String
    let destination: String
    let deepLink: String

    init?(dictionary: [String: Any]?) {
        guard let dictionary, let folio = dictionary["folio"] as? String else { return nil }
        self.folio = folio
        date = dictionary["date"] as? String ?? ""
        time = dictionary["time"] as? String ?? ""
        origin = dictionary["origin"] as? String ?? "Origen pendiente"
        destination = dictionary["destination"] as? String ?? "Destino pendiente"
        deepLink = dictionary["deepLink"] as? String ?? "tmsoperador://operator"
    }

    var schedule: String {
        let formattedDate: String
        if let parsed = Self.inputDateFormatter.date(from: date) {
            formattedDate = Self.outputDateFormatter.string(from: parsed)
        } else {
            formattedDate = date
        }
        let shortTime = String(time.prefix(5))
        return [formattedDate, shortTime].filter { !$0.isEmpty }.joined(separator: " · ")
    }

    private static let inputDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    private static let outputDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "es_CL")
        formatter.dateFormat = "dd/MM"
        return formatter
    }()
}

private struct OperatorWidgetEntry: TimelineEntry {
    let date: Date
    let service: WidgetService?
    let active: Bool
}

private struct OperatorWidgetProvider: TimelineProvider {
    let active: Bool

    func placeholder(in context: Context) -> OperatorWidgetEntry {
        OperatorWidgetEntry(
            date: Date(),
            service: WidgetService(dictionary: [
                "folio": active ? "SRV-2048" : "SRV-2051",
                "date": "2026-07-22",
                "time": active ? "12:30" : "15:00",
                "origin": "Copiapó",
                "destination": "Tierra Amarilla",
                "deepLink": active ? "tmsoperador://operator/active" : "tmsoperador://operator",
            ]),
            active: active
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (OperatorWidgetEntry) -> Void) {
        completion(context.isPreview ? placeholder(in: context) : currentEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<OperatorWidgetEntry>) -> Void) {
        let entry = currentEntry()
        let nextRefresh = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1_800)
        completion(Timeline(entries: [entry], policy: .after(nextRefresh)))
    }

    private func currentEntry() -> OperatorWidgetEntry {
        let defaults = UserDefaults(suiteName: appGroup)
        let key = active ? "active_service" : "next_service"
        let service = WidgetService(dictionary: defaults?.dictionary(forKey: key))
        return OperatorWidgetEntry(date: Date(), service: service, active: active)
    }
}

private struct OperatorWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: OperatorWidgetEntry

    private var accent: Color {
        entry.active
            ? Color(red: 0.20, green: 0.83, blue: 0.60)
            : Color(red: 0.65, green: 0.55, blue: 0.98)
    }

    var body: some View {
        ZStack {
            Color(red: 0.067, green: 0.094, blue: 0.153)
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 8) {
                    Text(entry.active ? "SERVICIO ACTIVO" : "PRÓXIMO SERVICIO")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(accent)
                    Spacer(minLength: 4)
                    Text(entry.active ? "EN CURSO" : "ASIGNADO")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(accent)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(accent.opacity(0.12), in: Capsule())
                        .overlay(Capsule().stroke(accent.opacity(0.45), lineWidth: 1))
                }

                if let service = entry.service {
                    Spacer(minLength: 0)
                    Text(service.folio)
                        .font(.system(size: family == .systemSmall ? 23 : 27, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Text(service.schedule.isEmpty ? "Horario pendiente" : service.schedule)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Color.white.opacity(0.7))
                    Text("\(service.origin)  →  \(service.destination)")
                        .font(.caption)
                        .foregroundStyle(.white)
                        .lineLimit(family == .systemSmall ? 2 : 1)
                        .privacySensitive()
                    Spacer(minLength: 0)
                } else {
                    Spacer()
                    Text(entry.active ? "No hay un servicio activo" : "No hay servicios próximos")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color.white.opacity(0.7))
                        .multilineTextAlignment(.leading)
                    Spacer()
                }
            }
            .padding(16)
        }
        .operatorWidgetBackground()
        .widgetURL(URL(string: entry.service?.deepLink ?? "tmsoperador://operator"))
    }
}

private extension View {
    @ViewBuilder
    func operatorWidgetBackground() -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            containerBackground(for: .widget) {
                Color(red: 0.067, green: 0.094, blue: 0.153)
            }
        } else {
            background(Color(red: 0.067, green: 0.094, blue: 0.153))
        }
    }
}

private struct NextServiceWidget: Widget {
    let kind = "TMSNextServiceWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: OperatorWidgetProvider(active: false)) { entry in
            OperatorWidgetView(entry: entry)
        }
        .configurationDisplayName("Próximo servicio")
        .description("Consulta tu siguiente servicio asignado.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

private struct ActiveServiceWidget: Widget {
    let kind = "TMSActiveServiceWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: OperatorWidgetProvider(active: true)) { entry in
            OperatorWidgetView(entry: entry)
        }
        .configurationDisplayName("Servicio activo")
        .description("Mantén visible el servicio que está en curso.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

@main
struct TMSOperatorWidgetBundle: WidgetBundle {
    var body: some Widget {
        NextServiceWidget()
        ActiveServiceWidget()
    }
}
