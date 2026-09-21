'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import {
  DEFAULT_PRELOAD_TURNS,
  calculateExtension,
  calculateTorsionByMeasurement,
  calculateTorsionByWeight,
  isUsableResult,
  round,
  wireDiameterFromCoils,
  type LiftType,
  type SpringResult,
  type SpringWarning,
} from '@/lib/spring-calculator/engine'
import {
  checkMeasurements,
  missingWeightNotice,
  requirePositive,
  requireSpringCount,
  type FieldError,
} from '@/lib/spring-calculator/validation'
import { buildSummary } from '@/lib/spring-calculator/summary'
import {
  convertForDisplay,
  lengthFromInch,
  lengthToInch,
  lengthUnit,
  weightFromLb,
  weightToLb,
  weightUnit,
  type UnitSystem,
} from '@/lib/spring-calculator/units'
import { Advanced, ChoiceCard, MeasurementField, ResultStat, SafetyNotice, StepHeading } from './parts'
import { saveCalculation, type SaveState } from './actions'

type SpringType = 'torsion' | 'extension' | 'unsure'
type Method = 'weight' | 'measurements' | 'compare'
type Step = 'type' | 'method' | 'inputs' | 'result'

interface AssetOption {
  id: string
  label: string
}

const num = (raw: string): number | null => {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const value = Number.parseFloat(trimmed)
  return Number.isFinite(value) ? value : Number.NaN
}

/** Formats for display, never emitting NaN, Infinity, null or undefined. */
function show(value: number | null | undefined, places = 2): string {
  if (value == null) return '—'
  const rounded = round(value, places)
  return rounded === null ? '—' : String(rounded)
}

export function SpringCalculator({
  assets,
  canSave,
}: {
  assets: AssetOption[]
  canSave: boolean
}) {
  const [system, setSystem] = useState<UnitSystem>('metric')
  const [step, setStep] = useState<Step>('type')
  const [springType, setSpringType] = useState<SpringType | null>(null)
  const [method, setMethod] = useState<Method | null>(null)

  // Raw strings, not numbers. Parsing on every keystroke fights the user
  // — "12." and "" are legitimate intermediate states.
  const [doorWeight, setDoorWeight] = useState('')
  const [doorHeight, setDoorHeight] = useState('')
  const [drumDiameter, setDrumDiameter] = useState('')
  const [springCount, setSpringCount] = useState('2')
  const [liftType, setLiftType] = useState<LiftType>('standard')
  const [wireDiameter, setWireDiameter] = useState('')
  const [coilSpan, setCoilSpan] = useState('')
  const [coilCount, setCoilCount] = useState('10')
  const [insideDiameter, setInsideDiameter] = useState('')
  const [bodyLength, setBodyLength] = useState('')
  const [preload, setPreload] = useState(String(DEFAULT_PRELOAD_TURNS))
  const [ratedCycles, setRatedCycles] = useState('')
  const [cyclesPerDay, setCyclesPerDay] = useState('')
  const [doorLabel, setDoorLabel] = useState('')
  const [assetId, setAssetId] = useState('')

  const [errors, setErrors] = useState<FieldError[]>([])
  const [result, setResult] = useState<SpringResult | null>(null)
  const [warnings, setWarnings] = useState<SpringWarning[]>([])
  const [copied, setCopied] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>({})
  const [advancedSummary, setAdvancedSummary] = useState(false)

  const w = weightUnit(system)
  const l = lengthUnit(system)
  const errorFor = (field: string) => errors.find((e) => e.field === field)?.message

  /** Flip units and bring the typed values with you. */
  function switchSystem(next: UnitSystem) {
    if (next === system) return
    setDoorWeight((v) => convertForDisplay(v, system, next, 'weight'))
    setDoorHeight((v) => convertForDisplay(v, system, next, 'length'))
    setDrumDiameter((v) => convertForDisplay(v, system, next, 'length'))
    setWireDiameter((v) => convertForDisplay(v, system, next, 'length'))
    setCoilSpan((v) => convertForDisplay(v, system, next, 'length'))
    setInsideDiameter((v) => convertForDisplay(v, system, next, 'length'))
    setBodyLength((v) => convertForDisplay(v, system, next, 'length'))
    setSystem(next)
  }

  // Wire diameter can be typed directly or derived from a coil span.
  // Derivation wins when both are present, because it is the method the
  // guide pushes and the more accurate of the two.
  const derivedWire = useMemo(() => {
    const span = num(coilSpan)
    const coils = num(coilCount)
    if (span == null || coils == null) return null
    return wireDiameterFromCoils(span, coils)
  }, [coilSpan, coilCount])

  const effectiveWire = derivedWire ?? num(wireDiameter)

  function reset() {
    setStep('type')
    setSpringType(null)
    setMethod(null)
    setDoorWeight('')
    setDoorHeight('')
    setDrumDiameter('')
    setSpringCount('2')
    setLiftType('standard')
    setWireDiameter('')
    setCoilSpan('')
    setCoilCount('10')
    setInsideDiameter('')
    setBodyLength('')
    setPreload(String(DEFAULT_PRELOAD_TURNS))
    setRatedCycles('')
    setCyclesPerDay('')
    setDoorLabel('')
    setAssetId('')
    setErrors([])
    setResult(null)
    setWarnings([])
    setSaveState({})
    setCopied(false)
  }

  function calculate() {
    const found: FieldError[] = []
    const count = num(springCount)
    const countError = requireSpringCount(count)
    if (countError) found.push(countError)

    if (springType === 'extension') {
      const weight = num(doorWeight)
      const e = requirePositive(weight, 'doorWeight', 'the door weight')
      if (e) found.push(e)
      if (found.length > 0) return setErrors(found)

      const doorWeightLb = weightToLb(weight as number, system)
      const calc = calculateExtension({
        doorWeightLb,
        springCount: count as number,
        ratedCycles: num(ratedCycles),
        cyclesPerDay: num(cyclesPerDay),
      })
      return finish(calc, checkMeasurements({ doorWeightLb }))
    }

    if (method === 'measurements' || method === 'compare') {
      const e1 = requirePositive(effectiveWire, 'wireDiameter', 'the wire diameter')
      const e2 = requirePositive(num(insideDiameter), 'insideDiameter', 'the inside diameter')
      const e3 = requirePositive(num(bodyLength), 'bodyLength', 'the spring body length')
      for (const e of [e1, e2, e3]) if (e) found.push(e)
      if (found.length > 0) return setErrors(found)

      const wireIn = lengthToInch(effectiveWire as number, system)
      const insideIn = lengthToInch(num(insideDiameter) as number, system)
      const bodyIn = lengthToInch(num(bodyLength) as number, system)
      const weight = num(doorWeight)
      const height = num(doorHeight)
      const drum = num(drumDiameter)

      const doorWeightLb = weight != null && !Number.isNaN(weight) ? weightToLb(weight, system) : null
      const doorHeightIn = height != null && !Number.isNaN(height) ? lengthToInch(height, system) : null
      const drumDiameterIn = drum != null && !Number.isNaN(drum) ? lengthToInch(drum, system) : null

      const calc = calculateTorsionByMeasurement({
        wireDiameterIn: wireIn,
        insideDiameterIn: insideIn,
        bodyLengthIn: bodyIn,
        springCount: count as number,
        doorWeightLb,
        doorHeightIn,
        drumDiameterIn,
      })
      const checks = checkMeasurements({
        wireDiameterIn: wireIn,
        insideDiameterIn: insideIn,
        bodyLengthIn: bodyIn,
        doorWeightLb,
        doorHeightIn,
        drumDiameterIn,
      })
      if (doorWeightLb == null) checks.push(missingWeightNotice())
      return finish(calc, checks)
    }

    // Mode A — door weight.
    const weight = num(doorWeight)
    const height = num(doorHeight)
    const drum = num(drumDiameter)
    const e1 = requirePositive(weight, 'doorWeight', 'the door weight')
    const e2 = requirePositive(height, 'doorHeight', 'the door height')
    const e3 = requirePositive(drum, 'drumDiameter', 'the cable drum diameter')
    for (const e of [e1, e2, e3]) if (e) found.push(e)
    if (found.length > 0) return setErrors(found)

    const doorWeightLb = weightToLb(weight as number, system)
    const doorHeightIn = lengthToInch(height as number, system)
    const drumDiameterIn = lengthToInch(drum as number, system)
    const preloadTurns = num(preload)

    const calc = calculateTorsionByWeight({
      doorWeightLb,
      doorHeightIn,
      drumDiameterIn,
      springCount: count as number,
      liftType,
      preloadTurns:
        preloadTurns != null && Number.isFinite(preloadTurns) ? preloadTurns : DEFAULT_PRELOAD_TURNS,
    })
    finish(calc, checkMeasurements({ doorWeightLb, doorHeightIn, drumDiameterIn }))
  }

  function finish(calc: SpringResult, checks: SpringWarning[]) {
    setErrors([])
    if (!isUsableResult(calc)) {
      setResult(null)
      setErrors([
        {
          field: 'form',
          message:
            'Those measurements do not produce a usable result. Check the values and try again — a zero or a mistyped unit is the usual cause.',
        },
      ])
      return
    }
    setResult(calc)
    setWarnings([...calc.warnings, ...checks])
    setStep('result')
  }

  const summary = useMemo(() => {
    if (!result) return null
    return buildSummary(result, {
      system,
      springType: springType === 'extension' ? 'extension' : 'torsion',
      doorLabel: doorLabel || null,
      advanced: advancedSummary,
    })
  }, [result, system, springType, doorLabel, advancedSummary])

  async function copy() {
    if (!summary) return
    try {
      await navigator.clipboard.writeText(summary)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  async function share() {
    if (!summary) return
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ title: 'Doorlink spring calculation', text: summary })
        return
      } catch {
        // Cancelled or unsupported — fall through to copying.
      }
    }
    await copy()
  }

  async function save() {
    if (!result || !summary) return
    setSaveState({})
    const state = await saveCalculation({
      assetId: assetId || null,
      doorLabel: doorLabel || null,
      springType: springType === 'extension' ? 'EXTENSION' : 'TORSION',
      method:
        springType === 'extension'
          ? 'EXTENSION'
          : method === 'weight'
            ? 'DOOR_WEIGHT'
            : 'EXISTING_SPRING',
      springCount: Number.parseInt(springCount, 10),
      liftType: springType === 'extension' ? null : liftType,
      doorWeightLb: num(doorWeight) != null ? weightToLb(num(doorWeight) as number, system) : null,
      doorHeightIn: num(doorHeight) != null ? lengthToInch(num(doorHeight) as number, system) : null,
      drumDiameterIn:
        num(drumDiameter) != null ? lengthToInch(num(drumDiameter) as number, system) : null,
      wireDiameterIn: effectiveWire != null ? lengthToInch(effectiveWire, system) : null,
      insideDiameterIn:
        num(insideDiameter) != null ? lengthToInch(num(insideDiameter) as number, system) : null,
      bodyLengthIn: num(bodyLength) != null ? lengthToInch(num(bodyLength) as number, system) : null,
      preloadTurns: num(preload),
      ipptPerSpring: result.kind === 'extension' ? null : result.ipptPerSpring,
      turns: result.kind === 'torsion-weight' ? result.turns : null,
      pullPerSpringLb: result.kind === 'extension' ? result.pullPerSpringLb : null,
      lifeYears: result.kind === 'extension' ? result.estimatedLifeYears : null,
      warnings: warnings.map((warning) => ({ code: warning.code, message: warning.message })),
    })
    setSaveState(state)
  }

  // -------------------------------------------------------------------
  // Steps
  // -------------------------------------------------------------------

  const totalSteps = springType === 'extension' ? 3 : 4

  return (
    <div className="flex flex-col gap-6 pb-44 sm:pb-28">
      <div className="flex items-center justify-between gap-3">
        <SafetyNoticeToggle />
        <div className="flex rounded border border-line" role="group" aria-label="Unit system">
          {(['metric', 'imperial'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => switchSystem(option)}
              aria-pressed={system === option}
              className={`min-h-[40px] px-3 text-sm ${
                system === option ? 'bg-signal text-paper' : 'text-graphite-soft'
              }`}
            >
              {option === 'metric' ? 'kg / mm' : 'lb / in'}
            </button>
          ))}
        </div>
      </div>

      {step === 'type' ? (
        <section className="flex flex-col gap-4">
          <StepHeading step={1} total={totalSteps} title="What type of spring system do you have?" />
          <div className="flex flex-col gap-3">
            <ChoiceCard
              title="Torsion spring"
              description="Mounted above the door on a shaft."
              selected={springType === 'torsion'}
              onSelect={() => setSpringType('torsion')}
            />
            <ChoiceCard
              title="Extension spring"
              description="Runs alongside the horizontal tracks."
              selected={springType === 'extension'}
              onSelect={() => setSpringType('extension')}
            />
            <ChoiceCard
              title="I'm not sure"
              selected={springType === 'unsure'}
              onSelect={() => setSpringType('unsure')}
            />
          </div>

          {springType === 'unsure' ? (
            <div className="flex flex-col gap-3 rounded border border-line bg-rail p-4">
              <p className="text-sm text-graphite-soft">
                Stand inside the garage with the door shut and look at where the springs sit.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <SpringDiagram kind="torsion" />
                <SpringDiagram kind="extension" />
              </div>
              <p className="text-sm text-graphite-soft">
                Look only. Do not touch, adjust or measure a spring that is under tension.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => setSpringType('torsion')}>
                  Mine is torsion
                </Button>
                <Button type="button" variant="secondary" onClick={() => setSpringType('extension')}>
                  Mine is extension
                </Button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {step === 'method' ? (
        <section className="flex flex-col gap-4">
          <StepHeading step={2} total={totalSteps} title="How would you like to calculate?" />
          <div className="flex flex-col gap-3">
            <ChoiceCard
              title="I know the door weight"
              description="The most reliable starting point."
              selected={method === 'weight'}
              onSelect={() => setMethod('weight')}
            />
            <ChoiceCard
              title="I have the existing spring measurements"
              description="Wire, inside diameter and body length."
              selected={method === 'measurements'}
              onSelect={() => setMethod('measurements')}
            />
            <ChoiceCard
              title="I want to compare or replace an existing spring"
              description="Measure the spring, and add the door details to compare."
              selected={method === 'compare'}
              onSelect={() => setMethod('compare')}
            />
          </div>
        </section>
      ) : null}

      {step === 'inputs' ? (
        <section className="flex flex-col gap-5">
          <StepHeading
            step={springType === 'extension' ? 2 : 3}
            total={totalSteps}
            title="Measurements"
          />

          {errorFor('form') ? (
            <p role="alert" className="rounded border border-alert/40 bg-alert/5 px-3 py-2 text-sm text-alert">
              {errorFor('form')}
            </p>
          ) : null}

          {springType === 'extension' ? (
            <>
              <MeasurementField
                id="doorWeight"
                label="Door weight"
                unit={w}
                value={doorWeight}
                onChange={setDoorWeight}
                guideId="doorWeight"
                error={errorFor('doorWeight')}
                system={system}
              />
              <SpringCountField value={springCount} onChange={setSpringCount} error={errorFor('springCount')} />
              <Advanced>
                <Field label="Rated cycles" htmlFor="ratedCycles" hint="From the spring or supplier, if known.">
                  <Input id="ratedCycles" value={ratedCycles} onChange={(e) => setRatedCycles(e.target.value)} inputMode="numeric" className="h-12 text-base" />
                </Field>
                <Field label="Door cycles per day" htmlFor="cyclesPerDay">
                  <Input id="cyclesPerDay" value={cyclesPerDay} onChange={(e) => setCyclesPerDay(e.target.value)} inputMode="numeric" className="h-12 text-base" />
                </Field>
              </Advanced>
            </>
          ) : method === 'weight' ? (
            <>
              <MeasurementField id="doorWeight" label="Door weight" unit={w} value={doorWeight} onChange={setDoorWeight} guideId="doorWeight" error={errorFor('doorWeight')} system={system} />
              <MeasurementField id="doorHeight" label="Door height" unit={l} value={doorHeight} onChange={setDoorHeight} guideId="doorHeight" error={errorFor('doorHeight')} system={system} />
              <MeasurementField id="drumDiameter" label="Cable drum diameter" unit={l} value={drumDiameter} onChange={setDrumDiameter} guideId="drumDiameter" error={errorFor('drumDiameter')} system={system} />
              <SpringCountField value={springCount} onChange={setSpringCount} error={errorFor('springCount')} />
              <Field label="Lift type" htmlFor="liftType">
                <Select id="liftType" value={liftType} onChange={(e) => setLiftType(e.target.value as LiftType)} className="h-12 text-base">
                  <option value="standard">Standard lift</option>
                  <option value="high">High lift</option>
                  <option value="vertical">Vertical lift</option>
                  <option value="custom">Custom</option>
                </Select>
              </Field>
              {liftType !== 'standard' ? (
                <p className="rounded border border-caution/40 bg-caution/5 px-3 py-2 text-sm text-graphite">
                  This calculator cannot reliably determine final spring sizing for this lift
                  configuration without additional system data. Treat the result as a rough starting
                  point and confirm against the drum chart for the system.
                </p>
              ) : null}
              <Advanced>
                <Field label="Preload turns" htmlFor="preload" hint="Extra turns beyond cable wrap. 0.75 is the common default.">
                  <Input id="preload" value={preload} onChange={(e) => setPreload(e.target.value)} inputMode="decimal" className="h-12 text-base" />
                </Field>
              </Advanced>
            </>
          ) : (
            <>
              <WireDiameterInput
                system={system}
                unit={l}
                coilSpan={coilSpan}
                coilCount={coilCount}
                wireDiameter={wireDiameter}
                derived={derivedWire}
                onSpan={setCoilSpan}
                onCount={setCoilCount}
                onWire={setWireDiameter}
                error={errorFor('wireDiameter')}
              />
              <MeasurementField id="insideDiameter" label="Inside diameter" unit={l} value={insideDiameter} onChange={setInsideDiameter} guideId="insideDiameter" error={errorFor('insideDiameter')} system={system} />
              <MeasurementField id="bodyLength" label="Spring body length" unit={l} value={bodyLength} onChange={setBodyLength} guideId="bodyLength" hint="The coiled body only — not the cones." error={errorFor('bodyLength')} system={system} />
              <SpringCountField value={springCount} onChange={setSpringCount} error={errorFor('springCount')} />
              <Advanced>
                <MeasurementField id="doorWeight" label="Door weight (optional)" unit={w} value={doorWeight} onChange={setDoorWeight} guideId="doorWeight" hint="Add this to compare the spring against what the door needs." system={system} />
                <MeasurementField id="doorHeight" label="Door height (optional)" unit={l} value={doorHeight} onChange={setDoorHeight} system={system} />
                <MeasurementField id="drumDiameter" label="Cable drum diameter (optional)" unit={l} value={drumDiameter} onChange={setDrumDiameter} system={system} />
              </Advanced>
            </>
          )}
        </section>
      ) : null}

      {step === 'result' && result ? (
        <section className="flex flex-col gap-5">
          <StepHeading step={totalSteps} total={totalSteps} title="Estimated spring requirement" />

          {result.kind === 'torsion-weight' ? (
            <>
              <ResultStat label="Required IPPT" value={show(result.ipptPerSpring, 1)} unit="in-lb/turn per spring" primary />
              <div className="grid gap-3 sm:grid-cols-2">
                <ResultStat label="Estimated turns" value={show(result.turns, 2)} />
                <ResultStat label="Springs" value={String(result.springCount)} />
                <ResultStat label="Door weight" value={show(weightFromLb(result.doorWeightLb, system), 1)} unit={w} />
                <ResultStat label="Drum diameter" value={show(lengthFromInch(result.drumRadiusIn * 2, system), 1)} unit={l} />
              </div>
            </>
          ) : null}

          {result.kind === 'torsion-measurement' ? (
            <>
              <ResultStat label="Measured spring rate" value={show(result.ipptPerSpring, 1)} unit="in-lb/turn per spring" primary />
              <div className="grid gap-3 sm:grid-cols-2">
                {result.requiredIpptPerSpring != null ? (
                  <ResultStat label="Required rate" value={show(result.requiredIpptPerSpring, 1)} unit="in-lb/turn" />
                ) : null}
                {result.turns != null ? <ResultStat label="Estimated turns" value={show(result.turns, 2)} /> : null}
                <ResultStat label="Springs" value={String(result.springCount)} />
                <ResultStat label="Active coils" value={show(result.activeCoils, 0)} />
              </div>
            </>
          ) : null}

          {result.kind === 'extension' ? (
            <>
              <ResultStat label="Estimated pull per spring" value={show(weightFromLb(result.pullPerSpringLb, system), 1)} unit={w} primary />
              <div className="grid gap-3 sm:grid-cols-2">
                <ResultStat label="Springs" value={String(result.springCount)} />
                <ResultStat label="Door weight" value={show(weightFromLb(result.doorWeightLb, system), 1)} unit={w} />
                {result.estimatedLifeYears != null ? (
                  <ResultStat label="Estimated service life" value={show(result.estimatedLifeYears, 1)} unit="years" />
                ) : null}
              </div>
            </>
          ) : null}

          {warnings.length > 0 ? (
            <div className="rounded border border-caution/40 bg-caution/5 p-4">
              <p className="text-sm font-medium text-graphite">Check your measurements</p>
              <ul className="mt-2 flex flex-col gap-2">
                {warnings.map((warning) => (
                  <li key={warning.code} className="text-sm text-graphite-soft">
                    {warning.message}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-graphite">This result should be verified.</p>
            </div>
          ) : null}

          <SafetyNotice />

          <div className="flex flex-col gap-3 rounded border border-line bg-paper p-4">
            <Field label="Door name (optional)" htmlFor="doorLabel" hint="Appears on the shared summary.">
              <Input id="doorLabel" value={doorLabel} onChange={(e) => setDoorLabel(e.target.value)} className="h-12 text-base" placeholder="Residential garage door" />
            </Field>

            {canSave ? (
              <>
                {assets.length > 0 ? (
                  <Field label="Save to asset (optional)" htmlFor="assetId">
                    <Select id="assetId" value={assetId} onChange={(e) => setAssetId(e.target.value)} className="h-12 text-base">
                      <option value="">Don&apos;t link to an asset</option>
                      {assets.map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : null}
                <div>
                  <Button type="button" variant="secondary" onClick={save}>
                    Save to Doorlink
                  </Button>
                </div>
                {saveState.error ? <p className="text-sm text-alert">{saveState.error}</p> : null}
                {saveState.reference ? (
                  <p className="text-sm text-signal">Saved as {saveState.reference}.</p>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-graphite-soft">
                <Link href="/sign-in?next=/tools/spring-calculator" className="text-signal underline">
                  Sign in
                </Link>{' '}
                to save this calculation against a door.
              </p>
            )}

            <label className="flex items-center gap-2 text-sm text-graphite-soft">
              <input type="checkbox" checked={advancedSummary} onChange={(e) => setAdvancedSummary(e.target.checked)} />
              Include engineering detail in the summary
            </label>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={share}>
                Share result
              </Button>
              <Button type="button" variant="secondary" onClick={copy}>
                {copied ? 'Copied' : 'Copy result'}
              </Button>
              <Button type="button" variant="ghost" onClick={reset}>
                Start again
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {/*
        Sticky so Calculate is reachable one-handed on a phone.

        The offset is not decoration. Doorlink already has a fixed
        MobileTabBar at the bottom on small screens (z-20, measured at
        ~62px), and a bar at bottom-0 sits underneath it — the tab bar
        swallows the taps and Calculate cannot be pressed at all. So this
        sits above the tab bar below `sm`, and drops to the bottom edge
        from `sm` up where the tab bar is hidden.
      */}
      <div className="fixed inset-x-0 bottom-[62px] z-10 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur sm:bottom-0">
        <div className="mx-auto flex max-w-2xl gap-3">
          {step !== 'type' ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                setStep(
                  step === 'result'
                    ? 'inputs'
                    : step === 'inputs'
                      ? springType === 'extension'
                        ? 'type'
                        : 'method'
                      : 'type'
                )
              }
            >
              Back
            </Button>
          ) : null}

          {step === 'type' ? (
            <Button
              type="button"
              className="flex-1"
              disabled={springType === null || springType === 'unsure'}
              onClick={() => setStep(springType === 'extension' ? 'inputs' : 'method')}
            >
              Next
            </Button>
          ) : null}

          {step === 'method' ? (
            <Button type="button" className="flex-1" disabled={method === null} onClick={() => setStep('inputs')}>
              Next
            </Button>
          ) : null}

          {step === 'inputs' ? (
            <Button type="button" className="flex-1" onClick={calculate}>
              Calculate
            </Button>
          ) : null}

          {step === 'result' ? (
            <Button type="button" className="flex-1" variant="secondary" onClick={reset}>
              Reset
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function SpringCountField({
  value,
  onChange,
  error,
}: {
  value: string
  onChange: (value: string) => void
  error?: string
}) {
  return (
    <Field label="Number of springs" htmlFor="springCount" error={error}>
      <div className="flex gap-2">
        {['1', '2'].map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            aria-pressed={value === option}
            className={`min-h-[48px] flex-1 rounded border text-sm ${
              value === option ? 'border-signal bg-signal-tint text-graphite' : 'border-line text-graphite-soft'
            }`}
          >
            {option}
          </button>
        ))}
        <Input
          aria-label="Other number of springs"
          value={value === '1' || value === '2' ? '' : value}
          onChange={(event) => onChange(event.target.value)}
          inputMode="numeric"
          placeholder="Other"
          className="h-12 flex-1 text-base"
        />
      </div>
    </Field>
  )
}

/**
 * Wire diameter, with the coil-span method first.
 *
 * The direct field is still there, but the span method leads because it
 * divides the measuring error by ten and this is the input the answer is
 * most sensitive to.
 */
function WireDiameterInput({
  system,
  unit,
  coilSpan,
  coilCount,
  wireDiameter,
  derived,
  onSpan,
  onCount,
  onWire,
  error,
}: {
  system: UnitSystem
  unit: string
  coilSpan: string
  coilCount: string
  wireDiameter: string
  derived: number | null
  onSpan: (v: string) => void
  onCount: (v: string) => void
  onWire: (v: string) => void
  error?: string
}) {
  return (
    <div className="flex flex-col gap-3 rounded border border-line bg-paper p-4">
      <p className="text-sm font-medium text-graphite">Wire diameter</p>
      <p className="text-sm text-graphite-soft">
        Measure across 10 or 20 coils and divide by the number of coils. This is more accurate than
        measuring a single coil, and it matters more than any other measurement here.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <MeasurementField id="coilSpan" label="Measurement across the coils" unit={unit} value={coilSpan} onChange={onSpan} system={system} />
        <Field label="Number of coils measured" htmlFor="coilCount">
          <Input id="coilCount" value={coilCount} onChange={(e) => onCount(e.target.value)} inputMode="numeric" className="h-12 text-base" />
        </Field>
      </div>
      {derived != null ? (
        <p className="rounded border border-line bg-rail px-3 py-2 font-code text-sm text-graphite">
          {coilSpan} ÷ {coilCount} = {show(derived, 3)} {unit} wire diameter
        </p>
      ) : (
        <MeasurementField id="wireDiameter" label="Or enter the wire diameter directly" unit={unit} value={wireDiameter} onChange={onWire} guideId="wireDiameter" error={error} system={system} />
      )}
      {derived != null && error ? <p className="text-sm text-alert">{error}</p> : null}
    </div>
  )
}

function SafetyNoticeToggle() {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="min-h-[40px] text-sm text-graphite-soft underline underline-offset-2"
      >
        Safety notice
      </button>
      {open ? (
        <div className="mt-2 max-w-prose">
          <SafetyNotice />
        </div>
      ) : null}
    </div>
  )
}

/** A simple inline diagram. No image assets, no dependency. */
function SpringDiagram({ kind }: { kind: 'torsion' | 'extension' }) {
  return (
    <div className="flex-1 rounded border border-line bg-paper p-3">
      <svg viewBox="0 0 120 80" className="h-24 w-full" role="img" aria-label={`${kind} spring layout`}>
        <rect x="10" y="20" width="100" height="52" fill="none" stroke="#2A2A2E" />
        {kind === 'torsion' ? (
          <>
            <line x1="10" y1="14" x2="110" y2="14" stroke="#A1A1A6" strokeWidth="2" />
            <rect x="40" y="9" width="40" height="10" fill="#FF6A00" />
          </>
        ) : (
          <>
            <line x1="6" y1="20" x2="6" y2="72" stroke="#A1A1A6" strokeWidth="2" />
            <rect x="2" y="30" width="8" height="30" fill="#FF6A00" />
            <line x1="114" y1="20" x2="114" y2="72" stroke="#A1A1A6" strokeWidth="2" />
            <rect x="110" y="30" width="8" height="30" fill="#FF6A00" />
          </>
        )}
      </svg>
      <p className="mt-2 text-sm font-medium text-graphite">
        {kind === 'torsion' ? 'Torsion' : 'Extension'}
      </p>
      <p className="text-sm text-graphite-soft">
        {kind === 'torsion'
          ? 'Above the door, on a shaft.'
          : 'Alongside the horizontal tracks, one each side.'}
      </p>
    </div>
  )
}
