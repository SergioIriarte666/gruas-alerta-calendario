# Guía de Testing - TMS Grúas

## Introducción

Esta guía cubre todas las estrategias y herramientas de testing para TMS Grúas, con especial énfasis en testing de funcionalidades responsive, componentes adaptativos y experiencias móviles.

## Configuración de Testing

### Dependencias de Testing

```json
{
  "devDependencies": {
    "@testing-library/react": "^13.4.0",
    "@testing-library/jest-dom": "^5.16.5",
    "@testing-library/user-event": "^14.4.3",
    "vitest": "^0.34.6",
    "jsdom": "^22.1.0",
    "@vitest/ui": "^0.34.6",
    "resize-observer-polyfill": "^1.5.1"
  }
}
```

### Configuración Vitest

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

### Setup de Testing

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom'
import 'resize-observer-polyfill/dist/ResizeObserver.global'

// Mock de window.matchMedia para responsive testing
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock de IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock de ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))
```

## Testing de Hooks Responsive

### Testing useDeviceType

```typescript
// src/hooks/__tests__/useDeviceType.test.tsx
import { renderHook } from '@testing-library/react'
import { useDeviceType } from '../useDeviceType'

// Mock de useBreakpoint
vi.mock('../useBreakpoint', () => ({
  useBreakpoint: vi.fn()
}))

const mockUseBreakpoint = vi.mocked(useBreakpoint)

describe('useDeviceType', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns mobile device type for mobile breakpoint', () => {
    mockUseBreakpoint.mockReturnValue({
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      isSmall: true,
      isMedium: false,
      isLarge: false,
      isXLarge: false,
    })

    const { result } = renderHook(() => useDeviceType())

    expect(result.current.deviceType).toBe('mobile')
    expect(result.current.isMobile).toBe(true)
    expect(result.current.isTablet).toBe(false)
    expect(result.current.isDesktop).toBe(false)
    expect(result.current.isTouchDevice).toBe(true)
  })

  it('returns tablet device type for tablet breakpoint', () => {
    mockUseBreakpoint.mockReturnValue({
      isMobile: false,
      isTablet: true,
      isDesktop: false,
      isSmall: false,
      isMedium: false,
      isLarge: false,
      isXLarge: false,
    })

    const { result } = renderHook(() => useDeviceType())

    expect(result.current.deviceType).toBe('tablet')
    expect(result.current.isTablet).toBe(true)
    expect(result.current.isTouchDevice).toBe(true)
  })

  it('returns desktop device type for desktop breakpoint', () => {
    mockUseBreakpoint.mockReturnValue({
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isSmall: false,
      isMedium: false,
      isLarge: true,
      isXLarge: false,
    })

    const { result } = renderHook(() => useDeviceType())

    expect(result.current.deviceType).toBe('desktop')
    expect(result.current.isDesktop).toBe(true)
    expect(result.current.isTouchDevice).toBe(false)
  })
})
```

### Testing useBreakpoint

```typescript
// src/hooks/__tests__/useBreakpoint.test.tsx
import { renderHook } from '@testing-library/react'
import { useBreakpoint } from '../useBreakpoint'

const mockMatchMedia = (width: number) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => {
      const mediaQuery = query.replace(/[()]/g, '')
      let matches = false

      if (mediaQuery.includes('min-width: 1024px')) {
        matches = width >= 1024
      } else if (mediaQuery.includes('min-width: 768px')) {
        matches = width >= 768
      } else if (mediaQuery.includes('min-width: 640px')) {
        matches = width >= 640
      } else if (mediaQuery.includes('min-width: 1280px')) {
        matches = width >= 1280
      }

      return {
        matches,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }
    }),
  })
}

describe('useBreakpoint', () => {
  it('detects mobile breakpoint correctly', () => {
    mockMatchMedia(375) // iPhone size

    const { result } = renderHook(() => useBreakpoint())

    expect(result.current.isMobile).toBe(true)
    expect(result.current.isTablet).toBe(false)
    expect(result.current.isDesktop).toBe(false)
    expect(result.current.isSmall).toBe(false)
  })

  it('detects tablet breakpoint correctly', () => {
    mockMatchMedia(768) // iPad size

    const { result } = renderHook(() => useBreakpoint())

    expect(result.current.isMobile).toBe(false)
    expect(result.current.isTablet).toBe(true)
    expect(result.current.isDesktop).toBe(false)
  })

  it('detects desktop breakpoint correctly', () => {
    mockMatchMedia(1440) // Desktop size

    const { result } = renderHook(() => useBreakpoint())

    expect(result.current.isMobile).toBe(false)
    expect(result.current.isTablet).toBe(false)
    expect(result.current.isDesktop).toBe(true)
    expect(result.current.isLarge).toBe(true)
  })
})
```

## Testing de Componentes Responsive

### Testing MetricCard

```typescript
// src/components/dashboard/__tests__/MetricCard.test.tsx
import { render, screen } from '@testing-library/react'
import { DollarSign } from 'lucide-react'
import { MetricCard } from '../MetricCard'

// Mock del hook useDeviceType
vi.mock('@/hooks/useDeviceType', () => ({
  useDeviceType: vi.fn()
}))

const mockUseDeviceType = vi.mocked(useDeviceType)

describe('MetricCard', () => {
  const defaultProps = {
    title: 'Test Metric',
    value: '$1,000',
    icon: DollarSign,
    trend: { value: 10, isPositive: true },
    description: 'Test description'
  }

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders correctly on mobile', () => {
    mockUseDeviceType.mockReturnValue({
      deviceType: 'mobile',
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      isTouchDevice: true,
      showMobileView: true,
      showTabletView: false,
      showDesktopView: false,
    })

    render(<MetricCard {...defaultProps} />)

    const card = screen.getByTestId('metric-card')
    expect(card).toHaveClass('flex-col') // Mobile layout
    expect(screen.getByText('Test Metric')).toBeInTheDocument()
    expect(screen.getByText('$1,000')).toBeInTheDocument()
  })

  it('renders correctly on tablet', () => {
    mockUseDeviceType.mockReturnValue({
      deviceType: 'tablet',
      isMobile: false,
      isTablet: true,
      isDesktop: false,
      isTouchDevice: true,
      showMobileView: false,
      showTabletView: true,
      showDesktopView: false,
    })

    render(<MetricCard {...defaultProps} />)

    const card = screen.getByTestId('metric-card')
    expect(card).toHaveClass('justify-between') // Tablet layout
  })

  it('renders correctly on desktop', () => {
    mockUseDeviceType.mockReturnValue({
      deviceType: 'desktop',
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isTouchDevice: false,
      showMobileView: false,
      showTabletView: false,
      showDesktopView: true,
    })

    render(<MetricCard {...defaultProps} />)

    const card = screen.getByTestId('metric-card')
    expect(card).toBeInTheDocument()
    // Desktop-specific assertions
  })

  it('displays trend information correctly', () => {
    mockUseDeviceType.mockReturnValue({
      deviceType: 'desktop',
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isTouchDevice: false,
      showMobileView: false,
      showTabletView: false,
      showDesktopView: true,
    })

    render(<MetricCard {...defaultProps} />)

    expect(screen.getByText('10%')).toBeInTheDocument()
    expect(screen.getByText('Test description')).toBeInTheDocument()
  })

  it('handles missing trend gracefully', () => {
    const propsWithoutTrend = { ...defaultProps, trend: undefined }
    
    mockUseDeviceType.mockReturnValue({
      deviceType: 'mobile',
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      isTouchDevice: true,
      showMobileView: true,
      showTabletView: false,
      showDesktopView: false,
    })

    render(<MetricCard {...propsWithoutTrend} />)

    expect(screen.queryByText('%')).not.toBeInTheDocument()
  })
})
```

### Testing Layout Components

```typescript
// src/components/layout/__tests__/Header.test.tsx
import { render, screen } from '@testing-library/react'
import { Header } from '../Header'
import { Button } from '@/components/ui/button'

vi.mock('@/hooks/useDeviceType')
const mockUseDeviceType = vi.mocked(useDeviceType)

describe('Header', () => {
  const defaultProps = {
    title: 'Test Page',
    subtitle: 'Test subtitle'
  }

  it('adapts layout for mobile devices', () => {
    mockUseDeviceType.mockReturnValue({
      deviceType: 'mobile',
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      isTouchDevice: true,
      showMobileView: true,
      showTabletView: false,
      showDesktopView: false,
    })

    render(
      <Header 
        {...defaultProps}
        actions={<Button>Action</Button>}
      />
    )

    const header = screen.getByRole('banner')
    expect(header).toHaveClass('flex-col') // Mobile stacking
  })

  it('shows horizontal layout for desktop', () => {
    mockUseDeviceType.mockReturnValue({
      deviceType: 'desktop',
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isTouchDevice: false,
      showMobileView: false,
      showTabletView: false,
      showDesktopView: true,
    })

    render(
      <Header 
        {...defaultProps}
        actions={<Button>Action</Button>}
      />
    )

    const header = screen.getByRole('banner')
    expect(header).toHaveClass('justify-between') // Desktop layout
  })
})
```

## Testing de Formularios

### Testing ServiceForm Responsive

```typescript
// src/components/services/__tests__/ServiceForm.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ServiceForm } from '../ServiceForm'

vi.mock('@/hooks/useDeviceType')
const mockUseDeviceType = vi.mocked(useDeviceType)

describe('ServiceForm', () => {
  const mockSubmit = vi.fn()
  const mockCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders single column layout on mobile', () => {
    mockUseDeviceType.mockReturnValue({
      deviceType: 'mobile',
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      isTouchDevice: true,
      showMobileView: true,
      showTabletView: false,
      showDesktopView: false,
    })

    render(
      <ServiceForm 
        mode="create"
        onSubmit={mockSubmit}
        onCancel={mockCancel}
      />
    )

    const form = screen.getByRole('form')
    expect(form).toHaveClass('grid-cols-1') // Mobile single column
  })

  it('renders multi-column layout on desktop', () => {
    mockUseDeviceType.mockReturnValue({
      deviceType: 'desktop',
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isTouchDevice: false,
      showMobileView: false,
      showTabletView: false,
      showDesktopView: true,
    })

    render(
      <ServiceForm 
        mode="create"
        onSubmit={mockSubmit}
        onCancel={mockCancel}
      />
    )

    const form = screen.getByRole('form')
    expect(form).toHaveClass('grid-cols-3') // Desktop multi-column
  })

  it('handles touch-friendly interactions', async () => {
    const user = userEvent.setup()
    
    mockUseDeviceType.mockReturnValue({
      deviceType: 'mobile',
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      isTouchDevice: true,
      showMobileView: true,
      showTabletView: false,
      showDesktopView: false,
    })

    render(
      <ServiceForm 
        mode="create"
        onSubmit={mockSubmit}
        onCancel={mockCancel}
      />
    )

    // Touch-friendly button sizes
    const submitButton = screen.getByRole('button', { name: /crear servicio/i })
    expect(submitButton).toHaveClass('h-11') // Touch-friendly height

    // Test touch interaction
    await user.click(submitButton)
    // Add assertions for touch behavior
  })

  it('validates required fields correctly', async () => {
    const user = userEvent.setup()

    render(
      <ServiceForm 
        mode="create"
        onSubmit={mockSubmit}
        onCancel={mockCancel}
      />
    )

    const submitButton = screen.getByRole('button', { name: /crear servicio/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/cliente es requerido/i)).toBeInTheDocument()
    })

    expect(mockSubmit).not.toHaveBeenCalled()
  })
})
```

## Testing de Utilidades

### Testing Vehicle Helpers

```typescript
// src/utils/__tests__/vehicleHelpers.test.ts
import { shouldShowVehicleInfo, formatVehicleInfo } from '../vehicleHelpers'

describe('vehicleHelpers', () => {
  describe('shouldShowVehicleInfo', () => {
    it('returns true when vehicle info is required', () => {
      const serviceType = {
        vehicle_brand_required: true,
        vehicle_model_required: false,
        license_plate_required: false,
        vehicle_info_optional: false
      }

      expect(shouldShowVehicleInfo(serviceType)).toBe(true)
    })

    it('returns true when vehicle info is not optional', () => {
      const serviceType = {
        vehicle_brand_required: false,
        vehicle_model_required: false,
        license_plate_required: false,
        vehicle_info_optional: false
      }

      expect(shouldShowVehicleInfo(serviceType)).toBe(true)
    })

    it('returns false when vehicle info is optional and not required', () => {
      const serviceType = {
        vehicle_brand_required: false,
        vehicle_model_required: false,
        license_plate_required: false,
        vehicle_info_optional: true
      }

      expect(shouldShowVehicleInfo(serviceType)).toBe(false)
    })

    it('returns false when serviceType is null', () => {
      expect(shouldShowVehicleInfo(null)).toBe(false)
    })
  })

  describe('formatVehicleInfo', () => {
    it('formats complete vehicle info correctly', () => {
      const service = {
        vehicle_brand: 'Toyota',
        vehicle_model: 'Camry',
        license_plate: 'ABC-123'
      }

      expect(formatVehicleInfo(service)).toBe('Toyota Camry (ABC-123)')
    })

    it('formats partial vehicle info correctly', () => {
      const service = {
        vehicle_brand: 'Toyota',
        vehicle_model: '',
        license_plate: 'ABC-123'
      }

      expect(formatVehicleInfo(service)).toBe('Toyota (ABC-123)')
    })

    it('returns default message for empty vehicle info', () => {
      const service = {
        vehicle_brand: '',
        vehicle_model: '',
        license_plate: ''
      }

      expect(formatVehicleInfo(service)).toBe('Sin información')
    })
  })
})
```

## Integration Tests

### Testing PWA Functionality

```typescript
// src/__tests__/pwa.test.ts
import { screen, waitFor } from '@testing-library/react'

describe('PWA Functionality', () => {
  beforeEach(() => {
    // Mock service worker
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: vi.fn(() => Promise.resolve()),
        ready: Promise.resolve({
          active: { postMessage: vi.fn() }
        })
      },
      writable: true
    })
  })

  it('registers service worker in production', async () => {
    // Mock production environment
    vi.stubEnv('PROD', true)

    // Dynamic import to trigger SW registration
    await import('../main')

    await waitFor(() => {
      expect(navigator.serviceWorker.register).toHaveBeenCalledWith('/sw.js')
    })
  })

  it('shows install prompt on mobile', async () => {
    const mockInstallPrompt = {
      prompt: vi.fn(),
      userChoice: Promise.resolve({ outcome: 'accepted' })
    }

    // Mock beforeinstallprompt event
    window.dispatchEvent(
      new CustomEvent('beforeinstallprompt', { 
        detail: mockInstallPrompt 
      })
    )

    // Simulate mobile device
    vi.mocked(useDeviceType).mockReturnValue({
      deviceType: 'mobile',
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      isTouchDevice: true,
      showMobileView: true,
      showTabletView: false,
      showDesktopView: false,
    })

    // Assert install banner is shown
    await waitFor(() => {
      expect(screen.queryByText(/instalar aplicación/i)).toBeInTheDocument()
    })
  })
})
```

### Testing Responsive Breakpoints End-to-End

```typescript
// src/__tests__/responsive-e2e.test.tsx
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import App from '../App'

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  )
}

describe('Responsive E2E Tests', () => {
  const resizeWindow = (width: number, height: number) => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: width,
    })
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: height,
    })
    window.dispatchEvent(new Event('resize'))
  }

  it('adapts layout from mobile to desktop', async () => {
    renderWithRouter(<App />)

    // Start with mobile
    resizeWindow(375, 667)
    await waitFor(() => {
      const sidebar = screen.queryByTestId('desktop-sidebar')
      expect(sidebar).not.toBeInTheDocument()
    })

    // Resize to desktop
    resizeWindow(1440, 900)
    await waitFor(() => {
      const sidebar = screen.queryByTestId('desktop-sidebar')
      expect(sidebar).toBeInTheDocument()
    })
  })

  it('shows appropriate components for each breakpoint', async () => {
    renderWithRouter(<App />)

    // Mobile - show mobile nav
    resizeWindow(375, 667)
    await waitFor(() => {
      expect(screen.queryByTestId('mobile-nav')).toBeInTheDocument()
      expect(screen.queryByTestId('desktop-nav')).not.toBeInTheDocument()
    })

    // Tablet - show tablet nav
    resizeWindow(768, 1024)
    await waitFor(() => {
      expect(screen.queryByTestId('tablet-nav')).toBeInTheDocument()
    })

    // Desktop - show desktop nav
    resizeWindow(1440, 900)
    await waitFor(() => {
      expect(screen.queryByTestId('desktop-nav')).toBeInTheDocument()
      expect(screen.queryByTestId('mobile-nav')).not.toBeInTheDocument()
    })
  })
})
```

## Performance Testing

### Testing Bundle Size

```typescript
// scripts/test-bundle-size.js
import { build } from 'vite'
import { gzipSync } from 'zlib'
import { readFileSync } from 'fs'

const testBundleSize = async () => {
  await build({
    build: {
      write: false,
      minify: true,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            responsive: ['@/hooks/useDeviceType', '@/hooks/useBreakpoint']
          }
        }
      }
    }
  })

  // Check that responsive chunks are properly separated
  const responsiveChunkSize = getChunkSize('responsive')
  expect(responsiveChunkSize).toBeLessThan(10 * 1024) // < 10KB
}
```

### Testing Component Performance

```typescript
// src/components/__tests__/performance.test.tsx
import { render } from '@testing-library/react'
import { act } from 'react-dom/test-utils'
import { MetricCard } from '../dashboard/MetricCard'

describe('Component Performance', () => {
  it('renders MetricCard without performance issues', () => {
    const startTime = performance.now()

    render(
      <MetricCard
        title="Test"
        value="$1000"
        icon={DollarSign}
      />
    )

    const endTime = performance.now()
    const renderTime = endTime - startTime

    expect(renderTime).toBeLessThan(16) // Should render in < 16ms (60fps)
  })

  it('handles rapid device type changes efficiently', () => {
    const mockUseDeviceType = vi.mocked(useDeviceType)
    const { rerender } = render(<MetricCard title="Test" value="$1000" icon={DollarSign} />)

    // Simulate rapid device changes
    const deviceTypes = ['mobile', 'tablet', 'desktop'] as const
    
    act(() => {
      deviceTypes.forEach(deviceType => {
        mockUseDeviceType.mockReturnValue({
          deviceType,
          isMobile: deviceType === 'mobile',
          isTablet: deviceType === 'tablet',
          isDesktop: deviceType === 'desktop',
          isTouchDevice: deviceType !== 'desktop',
          showMobileView: deviceType === 'mobile',
          showTabletView: deviceType === 'tablet',
          showDesktopView: deviceType === 'desktop',
        })
        rerender(<MetricCard title="Test" value="$1000" icon={DollarSign} />)
      })
    })

    // Should complete without errors
    expect(true).toBe(true)
  })
})
```

## Scripts de Testing

### Package.json Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:responsive": "vitest run --grep='responsive|mobile|tablet|desktop'",
    "test:hooks": "vitest run src/hooks",
    "test:components": "vitest run src/components",
    "test:e2e": "vitest run --grep='e2e'",
    "test:performance": "vitest run --grep='performance'"
  }
}
```

### CI/CD Testing

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm run test:run
      
      - name: Run responsive tests
        run: npm run test:responsive
      
      - name: Run performance tests
        run: npm run test:performance
      
      - name: Generate coverage
        run: npm run test:coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## Mejores Prácticas

### 1. Testing Strategy

- **Unit Tests**: Hooks y utilities (80% coverage)
- **Component Tests**: Componentes responsive (70% coverage)
- **Integration Tests**: Flujos completos (60% coverage)
- **E2E Tests**: Funcionalidades críticas (90% coverage)

### 2. Mock Strategy

```typescript
// Consistent device mocking
export const createDeviceMock = (deviceType: DeviceType) => ({
  deviceType,
  isMobile: deviceType === 'mobile',
  isTablet: deviceType === 'tablet',
  isDesktop: deviceType === 'desktop',
  isTouchDevice: deviceType !== 'desktop',
  showMobileView: deviceType === 'mobile',
  showTabletView: deviceType === 'tablet',
  showDesktopView: deviceType === 'desktop',
})
```

### 3. Test Organization

```
src/
├── __tests__/           # E2E and integration tests
├── components/
│   └── __tests__/       # Component-specific tests
├── hooks/
│   └── __tests__/       # Hook tests
├── utils/
│   └── __tests__/       # Utility tests
└── test/
    ├── setup.ts         # Test configuration
    ├── mocks/           # Mock utilities
    └── helpers/         # Test helpers
```

---

Esta guía proporciona una base sólida para testing comprehensivo de TMS Grúas, asegurando que las funcionalidades responsive y móviles funcionen correctamente en todos los dispositivos y escenarios.