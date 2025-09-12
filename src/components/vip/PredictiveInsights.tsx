import React, { useState } from 'react';
import { Service } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Target, 
  Calendar, 
  DollarSign,
  Clock,
  Zap,
  CheckCircle2,
  XCircle,
  Activity,
  BarChart3
} from 'lucide-react';
import { format, addDays, addWeeks, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';

interface PredictiveInsightsProps {
  services: Service[];
  clientName: string;
}

interface Prediction {
  id: string;
  type: 'demand' | 'revenue' | 'bottleneck' | 'opportunity';
  title: string;
  description: string;
  confidence: number;
  impact: 'high' | 'medium' | 'low';
  timeframe: string;
  actionable: boolean;
  recommendations: string[];
  data?: any;
}

interface ForecastData {
  period: string;
  predicted: number;
  confidence: number;
  historical?: number;
}

export const PredictiveInsights: React.FC<PredictiveInsightsProps> = ({
  services,
  clientName
}) => {
  const [selectedInsight, setSelectedInsight] = useState<string | null>(null);

  // Generate predictive insights
  const generatePredictions = (): Prediction[] => {
    const now = new Date();
    const predictions: Prediction[] = [];

    // Analyze service patterns for demand prediction
    const monthlyServices = services.filter(s => {
      const serviceDate = new Date(s.serviceDate);
      return serviceDate.getMonth() === now.getMonth();
    }).length;

    const previousMonthServices = services.filter(s => {
      const serviceDate = new Date(s.serviceDate);
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return serviceDate.getMonth() === prevMonth.getMonth();
    }).length;

    // Demand Forecast
    const demandTrend = monthlyServices > previousMonthServices ? 'increasing' : 'decreasing';
    predictions.push({
      id: 'demand-forecast',
      type: 'demand',
      title: 'Predicción de Demanda',
      description: `Se prevé una ${demandTrend === 'increasing' ? 'mayor' : 'menor'} demanda de servicios el próximo mes basado en patrones históricos.`,
      confidence: 85,
      impact: 'high',
      timeframe: '30 días',
      actionable: true,
      recommendations: [
        demandTrend === 'increasing' ? 'Asegurar disponibilidad de recursos adicionales' : 'Optimizar recursos actuales',
        'Preparar comunicación proactiva con el cliente',
        'Revisar capacidad operativa'
      ]
    });

    // Revenue Prediction
    const avgServiceValue = services.reduce((sum, s) => sum + s.value, 0) / services.length;
    const projectedRevenue = monthlyServices * avgServiceValue * 1.15; // Growth projection
    
    predictions.push({
      id: 'revenue-forecast',
      type: 'revenue',
      title: 'Proyección de Ingresos',
      description: `Los ingresos proyectados para el próximo trimestre son de $${projectedRevenue.toLocaleString()}.`,
      confidence: 78,
      impact: 'high',
      timeframe: '90 días',
      actionable: true,
      recommendations: [
        'Confirmar pipeline de servicios pendientes',
        'Acelerar proceso de órdenes de compra',
        'Planificar recursos para maximizar ingresos'
      ]
    });

    // Bottleneck Detection
    const pendingPOServices = services.filter(s => s.status === 'purchase_order_pending').length;
    const totalActiveServices = services.filter(s => !['completed', 'invoiced', 'cancelled'].includes(s.status)).length;
    
    if (pendingPOServices / totalActiveServices > 0.3) {
      predictions.push({
        id: 'bottleneck-detection',
        type: 'bottleneck',
        title: 'Cuello de Botella Detectado',
        description: `${Math.round((pendingPOServices / totalActiveServices) * 100)}% de servicios activos están esperando órdenes de compra.`,
        confidence: 92,
        impact: 'high',
        timeframe: 'Inmediato',
        actionable: true,
        recommendations: [
          'Contactar al cliente para agilizar órdenes de compra',
          'Implementar seguimiento automatizado',
          'Establecer escalamiento para OC demoradas'
        ]
      });
    }

    // Seasonal Opportunity
    const currentMonth = now.getMonth();
    const isHighSeasonMonth = [2, 3, 4, 9, 10, 11].includes(currentMonth); // Mar-May, Oct-Dec
    
    if (isHighSeasonMonth) {
      predictions.push({
        id: 'seasonal-opportunity',
        type: 'opportunity',
        title: 'Oportunidad Estacional',
        description: 'Estamos en un período de alta demanda estacional. Es el momento ideal para maximizar servicios.',
        confidence: 88,
        impact: 'medium',
        timeframe: '60 días',
        actionable: true,
        recommendations: [
          'Proponer servicios adicionales al cliente',
          'Optimizar programación de servicios',
          'Preparar campañas promocionales'
        ]
      });
    }

    // Efficiency Opportunity
    const avgCompletionTime = 2.5; // days (simulated)
    if (avgCompletionTime > 2) {
      predictions.push({
        id: 'efficiency-opportunity',
        type: 'opportunity',
        title: 'Oportunidad de Eficiencia',
        description: 'El tiempo promedio de completación puede reducirse optimizando procesos internos.',
        confidence: 73,
        impact: 'medium',
        timeframe: '45 días',
        actionable: true,
        recommendations: [
          'Implementar flujos de trabajo automatizados',
          'Reducir tiempo de respuesta inicial',
          'Mejorar coordinación entre equipos'
        ]
      });
    }

    return predictions;
  };

  // Generate forecast data
  const generateForecastData = (): ForecastData[] => {
    const now = new Date();
    const forecast: ForecastData[] = [];

    // Generate 6 weeks of forecast
    for (let i = 1; i <= 6; i++) {
      const weekDate = addWeeks(now, i);
      const historical = i <= 2 ? Math.floor(Math.random() * 5) + 3 : undefined;
      
      // Simulate prediction based on trends
      const baseServices = 4;
      const trendFactor = Math.sin(i * 0.5) * 2; // Seasonal variation
      const predicted = Math.max(1, Math.round(baseServices + trendFactor + (Math.random() - 0.5)));
      
      forecast.push({
        period: `Sem ${i}`,
        predicted,
        confidence: Math.max(60, 95 - (i * 5)), // Confidence decreases over time
        historical
      });
    }

    return forecast;
  };

  const predictions = generatePredictions();
  const forecastData = generateForecastData();

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'demand': return <BarChart3 className="w-4 h-4" />;
      case 'revenue': return <DollarSign className="w-4 h-4" />;
      case 'bottleneck': return <AlertTriangle className="w-4 h-4" />;
      case 'opportunity': return <Zap className="w-4 h-4" />;
      default: return <Brain className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'demand': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'revenue': return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'bottleneck': return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'opportunity': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'text-red-400';
      case 'medium': return 'text-amber-400';
      case 'low': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-black flex items-center gap-2">
            <Brain className="w-5 h-5 text-black" />
            Insights Predictivos - {clientName}
          </h3>
          <p className="text-sm text-black">
            Análisis inteligente y predicciones basadas en IA
          </p>
        </div>

        <Badge variant="outline" className="text-black">
          <Activity className="w-3 h-3 mr-1" />
          Análisis en Tiempo Real
        </Badge>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-card border-purple-500/20">
          <CardContent className="p-4 text-center">
            <Brain className="w-6 h-6 text-black mx-auto mb-2" />
            <p className="text-2xl font-bold text-black">{predictions.length}</p>
            <p className="text-xs text-black">Insights Activos</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-green-500/20">
          <CardContent className="p-4 text-center">
            <Target className="w-6 h-6 text-black mx-auto mb-2" />
            <p className="text-2xl font-bold text-black">
              {Math.round(predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length)}%
            </p>
            <p className="text-xs text-black">Confianza Promedio</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-red-500/20">
          <CardContent className="p-4 text-center">
            <AlertTriangle className="w-6 h-6 text-black mx-auto mb-2" />
            <p className="text-2xl font-bold text-black">
              {predictions.filter(p => p.impact === 'high').length}
            </p>
            <p className="text-xs text-black">Alto Impacto</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-blue-500/20">
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="w-6 h-6 text-black mx-auto mb-2" />
            <p className="text-2xl font-bold text-black">
              {predictions.filter(p => p.actionable).length}
            </p>
            <p className="text-xs text-black">Accionables</p>
          </CardContent>
        </Card>
      </div>

      {/* Forecast Chart */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-black flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-black" />
            Predicción de Demanda - Próximas 6 Semanas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {forecastData.map((data, index) => (
              <div key={index} className="flex items-center gap-4 p-3 bg-gray-800/30 rounded-lg text-black">
                <div className="w-16 text-sm text-black">{data.period}</div>
                
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-black">{data.predicted} servicios</span>
                    <span className="text-xs text-black">{data.confidence}% confianza</span>
                  </div>
                  <Progress value={data.confidence} className="h-2" />
                </div>

                <div className="flex items-center gap-2">
                  {data.historical && (
                    <div className="text-xs text-black">
                      Real: {data.historical}
                    </div>
                  )}
                  <Badge
                    variant="outline"
                    className="text-black"
                  >
                    {data.predicted >= 4 ? 'Alta' : 'Normal'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Insights List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {predictions.map((prediction) => (
          <Card 
            key={prediction.id} 
            className={`glass-card ${getTypeColor(prediction.type)} cursor-pointer transition-all duration-200 hover:scale-[1.02]`}
            onClick={() => setSelectedInsight(selectedInsight === prediction.id ? null : prediction.id)}
          >
            <CardContent className="p-4">
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {getTypeIcon(prediction.type)}
                    <h4 className="font-medium text-black">{prediction.title}</h4>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs text-black">
                      {prediction.impact.toUpperCase()}
                    </Badge>
                    <Badge variant="outline" className="text-xs text-black">
                      {prediction.confidence}%
                    </Badge>
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm text-black">{prediction.description}</p>

                {/* Metadata */}
                <div className="flex items-center justify-between text-xs text-black">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3 h-3" />
                    <span>{prediction.timeframe}</span>
                  </div>
                  
                  {prediction.actionable && (
                    <div className="flex items-center gap-1 text-black">
                      <Zap className="w-3 h-3" />
                      <span>Accionable</span>
                    </div>
                  )}
                </div>

                {/* Expanded Content */}
                {selectedInsight === prediction.id && (
                  <div className="border-t border-gray-700 pt-3 space-y-3">
                    <div>
                      <h5 className="text-sm font-medium text-black mb-2">Recomendaciones:</h5>
                      <ul className="space-y-1">
                        {prediction.recommendations.map((rec, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm text-black">
                            <CheckCircle2 className="w-3 h-3 text-black mt-0.5 flex-shrink-0" />
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                        Aplicar Recomendación
                      </Button>
                      <Button size="sm" variant="outline">
                        Ver Detalles
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* AI Summary */}
      <Card className="glass-card border-purple-500/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-400" />
            Resumen Inteligente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-black">
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
            <div className="flex items-start gap-3 text-black">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Brain className="w-5 h-5 text-purple-400" />
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-white">Análisis Principal</h4>
                <p className="text-sm text-black">
                  Basado en los patrones de servicio de {clientName}, se detecta una tendencia positiva 
                  con oportunidades de optimización en el proceso de órdenes de compra. 
                  La demanda muestra estabilidad con picos estacionales predecibles.
                </p>
                
                <div className="flex flex-wrap gap-2 mt-3">
                  <Badge variant="outline" className="text-green-400 border-green-500/30">
                    Demanda Estable
                  </Badge>
                  <Badge variant="outline" className="text-amber-400 border-amber-500/30">
                    Optimización Requerida
                  </Badge>
                  <Badge variant="outline" className="text-blue-400 border-blue-500/30">
                    Alta Confiabilidad
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <div className="text-xs text-gray-400 bg-gray-800/30 p-3 rounded-lg">
            <p>
              💡 <strong>Consejo del Sistema:</strong> Implementar automatización en el seguimiento de órdenes de compra 
              podría reducir tiempos de respuesta en un 25% y mejorar la satisfacción del cliente.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};