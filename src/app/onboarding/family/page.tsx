'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { SELECTABLE_SERVICES, SERVICE_FOCUS_NOTE } from '@/lib/services'

const SERVICES = SELECTABLE_SERVICES

type Answers = Record<string, any>

export default function FamilyOnboarding() {
  const [step, setStep] = useState('services')
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [serviceQueue, setServiceQueue] = useState<string[]>([])
  const [answers, setAnswers] = useState<Answers>({})
  const [zipcode, setZipcode] = useState('')
  const [zipcodeInfo, setZipcodeInfo] = useState<{ city: string; state: string } | null>(null)
  const [zipcodeLoading, setZipcodeLoading] = useState(false)
  const [zipcodeError, setZipcodeError] = useState('')
  const router = useRouter()

  const save = (key: string, value: any) => setAnswers(prev => ({ ...prev, [key]: value }))

  const toggleService = (id: string) => {
    setSelectedServices(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  const buildQueue = (services: string[]) => {
    const queue: string[] = []
    if (services.includes('childcare')) queue.push('childcare_type', 'childcare_when', 'childcare_schedule', 'childcare_kids', 'childcare_ages', 'childcare_extras', 'childcare_budget')
    if (services.includes('chef')) queue.push('chef_type', 'chef_cuisine', 'chef_details', 'chef_budget')
    if (services.includes('housekeeping')) queue.push('house_type', 'house_size', 'house_frequency', 'house_extras', 'house_budget')
    if (services.includes('elder_care')) queue.push('elder_needs', 'elder_frequency', 'elder_living', 'elder_budget')
    if (services.includes('pet_care')) queue.push('pet_type', 'pet_service', 'pet_when', 'pet_budget')
    if (services.includes('tutoring')) queue.push('tutor_needs', 'tutor_subject', 'tutor_age', 'tutor_budget')
    return queue
  }

  const startFlow = () => {
    const queue = buildQueue(selectedServices)
    setServiceQueue(queue)
    setStep(queue[0])
  }

  const next = (currentStep: string) => {
    const idx = serviceQueue.indexOf(currentStep)
    if (idx < serviceQueue.length - 1) setStep(serviceQueue[idx + 1])
    else setStep('zipcode') // 最后一步去 zipcode
  }

  const back = (currentStep: string) => {
    const idx = serviceQueue.indexOf(currentStep)
    if (idx === 0) setStep('services')
    else setStep(serviceQueue[idx - 1])
  }

  const lookupZipcode = async (zip: string) => {
    if (zip.length !== 5) { setZipcodeInfo(null); setZipcodeError(''); return }
    setZipcodeLoading(true)
    setZipcodeError('')
    try {
      const res = await fetch(`https://api.zippopotam.us/us/${zip}`)
      if (!res.ok) { setZipcodeError('Invalid ZIP code'); setZipcodeInfo(null) }
      else {
        const data = await res.json()
        const place = data.places?.[0]
        if (place) setZipcodeInfo({ city: place['place name'], state: place['state abbreviation'] })
      }
    } catch { setZipcodeError('Could not verify') }
    finally { setZipcodeLoading(false) }
  }

  const handleZipcodeChange = (val: string) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 5)
    setZipcode(cleaned)
    lookupZipcode(cleaned)
  }

  const goToRegister = () => {
    const finalAnswers = {
      ...answers,
      services: selectedServices,
      zipcode,
      city: zipcodeInfo?.city,
      state: zipcodeInfo?.state,
    }
    router.push(`/onboarding/register?role=family&answers=${encodeURIComponent(JSON.stringify(finalAnswers))}`)
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md">

        {/* 选服务 */}
        {step === 'services' && (
          <div>
            <button onClick={() => router.push('/')} className="text-gray-400 text-sm mb-8 hover:text-gray-600">← Back</button>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">What kind of care do you need?</h1>
            <p className="text-gray-400 text-sm mb-8">{SERVICE_FOCUS_NOTE}</p>
            <div className={`grid gap-3 mb-8 ${SERVICES.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {SERVICES.map(s => (
                <button key={s.id} onClick={() => toggleService(s.id)}
                  className={`p-4 rounded-2xl border-2 text-left transition ${selectedServices.includes(s.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="text-2xl mb-1">{s.emoji}</div>
                  <div className="font-medium text-sm text-gray-900">{s.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{s.desc}</div>
                </button>
              ))}
            </div>
            <button onClick={startFlow} disabled={selectedServices.length === 0}
              className="w-full bg-blue-600 text-white py-4 rounded-2xl font-semibold disabled:opacity-40 hover:bg-blue-700 transition">
              Continue →
            </button>
          </div>
        )}

        {/* ===== CHILDCARE ===== */}
        {step === 'childcare_type' && (
          <Q title="What kind of childcare do you need?" onBack={() => setStep('services')}>
            {[
              { id: 'babysitter', label: '🍼 One-time Babysitter', desc: 'For a specific date or occasion' },
              { id: 'nanny', label: '👩‍👧 Recurring Nanny', desc: 'Regular ongoing help' },
            ].map(opt => <Opt key={opt.id} {...opt} selected={answers.childcare_type === opt.id} onClick={() => { save('childcare_type', opt.id); next('childcare_type') }} />)}
          </Q>
        )}

        {step === 'childcare_when' && (
          <Q title="When do you need to start?" onBack={() => back('childcare_when')}>
            {[
              { id: 'asap', label: '⚡ Right away' },
              { id: 'week', label: '📅 Within a week' },
              { id: 'month', label: '🗓 Within a month' },
              { id: 'flexible', label: '😊 I\'m flexible' },
            ].map(opt => <Opt key={opt.id} {...opt} selected={answers.childcare_when === opt.id} onClick={() => { save('childcare_when', opt.id); next('childcare_when') }} />)}
          </Q>
        )}

        {step === 'childcare_schedule' && (
          <Q title="How often do you need help?" onBack={() => back('childcare_schedule')}>
            {[
              { id: 'fulltime', label: '🗓 Full-time', desc: '5 days/week' },
              { id: 'parttime', label: '⏰ Part-time', desc: '2–4 days/week' },
              { id: 'occasional', label: '🌟 Occasional', desc: 'As needed' },
              { id: 'overnight', label: '🌙 Overnight', desc: 'Overnight care' },
            ].map(opt => <Opt key={opt.id} {...opt} selected={answers.childcare_schedule === opt.id} onClick={() => { save('childcare_schedule', opt.id); next('childcare_schedule') }} />)}
          </Q>
        )}

        {step === 'childcare_kids' && (
          <Q title="How many children?" onBack={() => back('childcare_kids')}>
            <div className="grid grid-cols-4 gap-3">
              {[1, 2, 3, '4+'].map(n => (
                <button key={n} onClick={() => { save('childcare_kids', n); next('childcare_kids') }}
                  className={`py-4 rounded-2xl border-2 font-bold text-lg transition ${answers.childcare_kids === n ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 hover:border-gray-300'}`}>
                  {n}
                </button>
              ))}
            </div>
          </Q>
        )}

        {step === 'childcare_ages' && (
          <Q title="How old are your kids?" onBack={() => back('childcare_ages')}>
            {[
              { id: 'infant', label: '👶 Infant', desc: '0–12 months' },
              { id: 'toddler', label: '🧒 Toddler', desc: '1–3 years' },
              { id: 'preschool', label: '🎨 Preschool', desc: '3–5 years' },
              { id: 'school', label: '🎒 School age', desc: '5–12 years' },
              { id: 'teen', label: '🧑 Teen', desc: '13+ years' },
            ].map(opt => <Opt key={opt.id} {...opt} multi selected={(answers.childcare_ages || []).includes(opt.id)}
              onClick={() => { const c = answers.childcare_ages || []; save('childcare_ages', c.includes(opt.id) ? c.filter((a: string) => a !== opt.id) : [...c, opt.id]) }} />)}
            <button onClick={() => next('childcare_ages')} disabled={!answers.childcare_ages?.length}
              className="w-full mt-4 bg-blue-600 text-white py-4 rounded-2xl font-semibold disabled:opacity-40">Continue →</button>
          </Q>
        )}

        {step === 'childcare_extras' && (
          <Q title="Any extra needs?" onBack={() => back('childcare_extras')}>
            {[
              { id: 'bilingual', label: '🗣 Bilingual caregiver', desc: 'Speaks Mandarin, Spanish, etc.' },
              { id: 'homework', label: '📖 Homework help' },
              { id: 'driving', label: '🚗 Can drive kids' },
              { id: 'cooking', label: '🍱 Can cook meals' },
              { id: 'none', label: '✅ No extras needed' },
            ].map(opt => <Opt key={opt.id} {...opt} multi selected={(answers.childcare_extras || []).includes(opt.id)}
              onClick={() => {
                if (opt.id === 'none') { save('childcare_extras', ['none']); next('childcare_extras'); return }
                const c = (answers.childcare_extras || []).filter((e: string) => e !== 'none')
                save('childcare_extras', c.includes(opt.id) ? c.filter((e: string) => e !== opt.id) : [...c, opt.id])
              }} />)}
            <button onClick={() => next('childcare_extras')} disabled={!answers.childcare_extras?.length}
              className="w-full mt-4 bg-blue-600 text-white py-4 rounded-2xl font-semibold disabled:opacity-40">Continue →</button>
          </Q>
        )}

        {step === 'childcare_budget' && (
          <BudgetRange
            title="What's your hourly budget for childcare?"
            unit="hr"
            options={['$15–25', '$25–35', '$35–60', '$60+']}
            selected={answers.childcare_budget}
            onSelect={val => { save('childcare_budget', val); next('childcare_budget') }}
            onBack={() => back('childcare_budget')}
          />
        )}

        {/* ===== CHEF ===== */}
        {step === 'chef_type' && (
          <Q title="What kind of chef service do you need?" onBack={() => back('chef_type')}>
            {[
              { id: 'dinner', label: '🍽 One-time Dinner', desc: 'A special occasion meal' },
              { id: 'mealprep', label: '🥗 Weekly Meal Prep', desc: 'Regular cooking sessions' },
            ].map(opt => <Opt key={opt.id} {...opt} selected={answers.chef_type === opt.id} onClick={() => { save('chef_type', opt.id); next('chef_type') }} />)}
          </Q>
        )}

        {step === 'chef_cuisine' && (
          <Q title="What cuisine do you prefer?" onBack={() => back('chef_cuisine')}>
            {[
              { id: 'chinese', label: '🥢 Chinese' },
              { id: 'japanese', label: '🍱 Japanese' },
              { id: 'korean', label: '🥘 Korean' },
              { id: 'thai', label: '🌶 Thai' },
              { id: 'vietnamese', label: '🍜 Vietnamese' },
              { id: 'indian', label: '🍛 Indian' },
              { id: 'mediterranean', label: '🫒 Mediterranean' },
              { id: 'european', label: '🥐 European' },
              { id: 'american', label: '🍔 American' },
              { id: 'other', label: '🌍 Other' },
            ].map(opt => <Opt key={opt.id} {...opt} selected={answers.chef_cuisine === opt.id}
              onClick={() => { save('chef_cuisine', opt.id); next('chef_cuisine') }} />)}
          </Q>
        )}

        {step === 'chef_details' && (
          <Q title="Tell us more about your needs" onBack={() => back('chef_details')}>
            {[
              { id: '2', label: '👤 2 people' },
              { id: '4', label: '👥 4 people' },
              { id: 'family', label: '👨‍👩‍👧 Family (5+)' },
            ].map(opt => <Opt key={opt.id} {...opt} selected={answers.chef_people === opt.id}
              onClick={() => save('chef_people', opt.id)} />)}
            <div className="mt-4 space-y-2">
              {[
                { id: 'low_oil', label: '🥗 Low oil / healthy' },
                { id: 'high_protein', label: '💪 High protein' },
                { id: 'vegetarian', label: '🌱 Vegetarian' },
                { id: 'no_pref', label: '😊 No preference' },
              ].map(opt => <Opt key={opt.id} {...opt} selected={answers.chef_diet === opt.id}
                onClick={() => save('chef_diet', opt.id)} />)}
            </div>
            <div className="mt-4">
              <label className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-2xl cursor-pointer hover:border-gray-300">
                <input type="checkbox" checked={answers.chef_grocery || false}
                  onChange={e => save('chef_grocery', e.target.checked)} className="w-4 h-4 accent-blue-600" />
                <span className="font-medium text-gray-900">🛒 Chef brings groceries</span>
              </label>
            </div>
            <button onClick={() => next('chef_details')} disabled={!answers.chef_people || !answers.chef_diet}
              className="w-full mt-4 bg-blue-600 text-white py-4 rounded-2xl font-semibold disabled:opacity-40">Continue →</button>
          </Q>
        )}

        {step === 'chef_budget' && (
          <BudgetRange
            title="What's your hourly budget for a private chef?"
            unit="hr"
            options={['$15–25', '$25–40', '$40–60', '$60+']}
            selected={answers.chef_budget}
            onSelect={val => { save('chef_budget', val); next('chef_budget') }}
            onBack={() => back('chef_budget')}
          />
        )}

        {/* ===== HOUSEKEEPER ===== */}
        {step === 'house_type' && (
          <Q title="What kind of cleaning do you need?" onBack={() => back('house_type')}>
            {[
              { id: 'deep', label: '🧹 One-time Deep Clean', desc: 'Thorough top-to-bottom cleaning' },
              { id: 'regular', label: '✨ Regular Cleaning', desc: 'Ongoing maintenance cleaning' },
            ].map(opt => <Opt key={opt.id} {...opt} selected={answers.house_type === opt.id} onClick={() => { save('house_type', opt.id); next('house_type') }} />)}
          </Q>
        )}

        {step === 'house_size' && (
          <Q title="How big is your home?" onBack={() => back('house_size')}>
            {[
              { id: 'studio', label: '🏠 Studio / 1BR' },
              { id: '2br', label: '🏡 2–3 Bedrooms' },
              { id: '4br', label: '🏘 4–5 Bedrooms' },
              { id: '5plus', label: '🏰 5+ Bedrooms' },
            ].map(opt => <Opt key={opt.id} {...opt} selected={answers.house_size === opt.id} onClick={() => { save('house_size', opt.id); next('house_size') }} />)}
          </Q>
        )}

        {step === 'house_frequency' && (
          <Q title="How often do you need cleaning?" onBack={() => back('house_frequency')}>
            {[
              { id: 'weekly', label: '📅 Weekly' },
              { id: 'biweekly', label: '🗓 Bi-weekly' },
              { id: 'monthly', label: '📆 Monthly' },
              { id: 'onetime', label: '1️⃣ One-time only' },
            ].map(opt => <Opt key={opt.id} {...opt} selected={answers.house_frequency === opt.id} onClick={() => { save('house_frequency', opt.id); next('house_frequency') }} />)}
          </Q>
        )}

        {step === 'house_extras' && (
          <Q title="Any extra tasks?" onBack={() => back('house_extras')}>
            {[
              { id: 'laundry', label: '👕 Laundry & folding' },
              { id: 'dishes', label: '🍽 Dishes & kitchen' },
              { id: 'organizing', label: '📦 Organizing' },
              { id: 'windows', label: '🪟 Window cleaning' },
              { id: 'none', label: '✅ Standard cleaning only' },
            ].map(opt => <Opt key={opt.id} {...opt} multi selected={(answers.house_extras || []).includes(opt.id)}
              onClick={() => {
                if (opt.id === 'none') { save('house_extras', ['none']); next('house_extras'); return }
                const c = (answers.house_extras || []).filter((e: string) => e !== 'none')
                save('house_extras', c.includes(opt.id) ? c.filter((e: string) => e !== opt.id) : [...c, opt.id])
              }} />)}
            <button onClick={() => next('house_extras')} disabled={!answers.house_extras?.length}
              className="w-full mt-4 bg-blue-600 text-white py-4 rounded-2xl font-semibold disabled:opacity-40">Continue →</button>
          </Q>
        )}

        {step === 'house_budget' && (
          <BudgetRange
            title="What's your budget per cleaning session?"
            unit="session"
            options={['$50–100', '$100–200', '$200–400', '$400+']}
            selected={answers.house_budget}
            onSelect={val => { save('house_budget', val); next('house_budget') }}
            onBack={() => back('house_budget')}
          />
        )}

        {/* ===== ELDER CARE ===== */}
        {step === 'elder_needs' && (
          <Q title="What kind of elder care do you need?" onBack={() => back('elder_needs')}>
            {[
              { id: 'companionship', label: '🤝 Companionship', desc: 'Social interaction & company' },
              { id: 'home_help', label: '🏠 Help around the home', desc: 'Light housework & errands' },
              { id: 'transportation', label: '🚗 Transportation', desc: 'Driving to appointments' },
              { id: 'meal_help', label: '🍱 Meal help', desc: 'Cooking & feeding assistance' },
            ].map(opt => <Opt key={opt.id} {...opt} multi selected={(answers.elder_needs || []).includes(opt.id)}
              onClick={() => { const c = answers.elder_needs || []; save('elder_needs', c.includes(opt.id) ? c.filter((a: string) => a !== opt.id) : [...c, opt.id]) }} />)}
            <button onClick={() => next('elder_needs')} disabled={!answers.elder_needs?.length}
              className="w-full mt-4 bg-blue-600 text-white py-4 rounded-2xl font-semibold disabled:opacity-40">Continue →</button>
          </Q>
        )}

        {step === 'elder_frequency' && (
          <Q title="How often do you need help?" onBack={() => back('elder_frequency')}>
            {[
              { id: 'daily', label: '📅 Daily' },
              { id: 'few_week', label: '🗓 A few times a week' },
              { id: 'weekends', label: '🌅 Weekends only' },
              { id: 'flexible', label: '😊 Flexible' },
            ].map(opt => <Opt key={opt.id} {...opt} selected={answers.elder_frequency === opt.id} onClick={() => { save('elder_frequency', opt.id); next('elder_frequency') }} />)}
          </Q>
        )}

        {step === 'elder_living' && (
          <Q title="What arrangement do you prefer?" onBack={() => back('elder_living')}>
            {[
              { id: 'livein', label: '🏠 Live-in caregiver', desc: 'Caregiver stays at home' },
              { id: 'visits', label: '🚗 Daily visits', desc: 'Caregiver comes and goes' },
              { id: 'open', label: '🤔 Open to discuss' },
            ].map(opt => <Opt key={opt.id} {...opt} selected={answers.elder_living === opt.id} onClick={() => { save('elder_living', opt.id); next('elder_living') }} />)}
          </Q>
        )}

        {step === 'elder_budget' && (
          <BudgetRange
            title="What's your hourly budget for elder care?"
            unit="hr"
            options={['$15–25', '$25–40', '$40–60', '$60+']}
            selected={answers.elder_budget}
            onSelect={val => { save('elder_budget', val); next('elder_budget') }}
            onBack={() => back('elder_budget')}
          />
        )}

        {/* ===== PET CARE ===== */}
        {step === 'pet_type' && (
          <Q title="What kind of pet do you have?" onBack={() => back('pet_type')}>
            {[
              { id: 'dog', label: '🐶 Dog' },
              { id: 'cat', label: '🐱 Cat' },
              { id: 'bird', label: '🐦 Bird' },
              { id: 'other', label: '🐾 Other' },
            ].map(opt => <Opt key={opt.id} {...opt} selected={answers.pet_type === opt.id} onClick={() => { save('pet_type', opt.id); next('pet_type') }} />)}
          </Q>
        )}

        {step === 'pet_service' && (
          <Q title="What kind of pet care do you need?" onBack={() => back('pet_service')}>
            {[
              ...(answers.pet_type === 'dog' ? [{ id: 'walking', label: '🦮 Dog Walking', desc: 'Daily walks' }] : []),
              { id: 'sitting', label: '🏠 Pet Sitting', desc: 'At your home' },
              { id: 'boarding', label: '🛏 Boarding', desc: 'At caregiver\'s home' },
              { id: 'checkin', label: '✅ Drop-in Visit', desc: 'Quick check-ins' },
            ].map(opt => <Opt key={opt.id} {...opt} selected={answers.pet_service === opt.id} onClick={() => { save('pet_service', opt.id); next('pet_service') }} />)}
          </Q>
        )}

        {step === 'pet_when' && (
          <Q title="When do you need pet care?" onBack={() => back('pet_when')}>
            {[
              { id: 'asap', label: '⚡ Right away' },
              { id: 'week', label: '📅 Within a week' },
              { id: 'month', label: '🗓 Within a month' },
              { id: 'flexible', label: '😊 I\'m flexible' },
            ].map(opt => <Opt key={opt.id} {...opt} selected={answers.pet_when === opt.id} onClick={() => { save('pet_when', opt.id); next('pet_when') }} />)}
          </Q>
        )}

        {step === 'pet_budget' && (
          <BudgetRange
            title={answers.pet_service === 'boarding' ? "What's your daily budget for boarding?" : "What's your hourly budget for pet care?"}
            unit={answers.pet_service === 'boarding' ? 'day' : 'hr'}
            options={answers.pet_service === 'boarding'
              ? ['$0–30', '$30–60', '$60–100', '$100+']
              : ['$10–20', '$20–35', '$35–50', '$50+']}
            selected={answers.pet_budget}
            onSelect={val => { save('pet_budget', val); next('pet_budget') }}
            onBack={() => back('pet_budget')}
          />
        )}

        {/* ===== TUTORING ===== */}
        {step === 'tutor_needs' && (
          <Q title="What does your child need help with?" onBack={() => back('tutor_needs')}>
            {[
              { id: 'homework', label: '📖 Homework help' },
              { id: 'grades', label: '📈 Improve grades' },
              { id: 'focus', label: '🎯 Focus & study habits' },
              { id: 'language', label: '🗣 Language learning' },
              { id: 'testprep', label: '✏️ Test prep' },
            ].map(opt => <Opt key={opt.id} {...opt} multi selected={(answers.tutor_needs || []).includes(opt.id)}
              onClick={() => { const c = answers.tutor_needs || []; save('tutor_needs', c.includes(opt.id) ? c.filter((a: string) => a !== opt.id) : [...c, opt.id]) }} />)}
            <button onClick={() => next('tutor_needs')} disabled={!answers.tutor_needs?.length}
              className="w-full mt-4 bg-blue-600 text-white py-4 rounded-2xl font-semibold disabled:opacity-40">Continue →</button>
          </Q>
        )}

        {step === 'tutor_subject' && (
          <Q title="What subject?" onBack={() => back('tutor_subject')}>
            {[
              { id: 'math', label: '🔢 Math' },
              { id: 'english', label: '📝 English' },
              { id: 'science', label: '🔬 Science' },
              { id: 'chinese', label: '🀄 Chinese / Mandarin' },
              { id: 'other', label: '📚 Other' },
            ].map(opt => <Opt key={opt.id} {...opt} multi selected={(answers.tutor_subject || []).includes(opt.id)}
              onClick={() => { const c = answers.tutor_subject || []; save('tutor_subject', c.includes(opt.id) ? c.filter((a: string) => a !== opt.id) : [...c, opt.id]) }} />)}
            <button onClick={() => next('tutor_subject')} disabled={!answers.tutor_subject?.length}
              className="w-full mt-4 bg-blue-600 text-white py-4 rounded-2xl font-semibold disabled:opacity-40">Continue →</button>
          </Q>
        )}

        {step === 'tutor_age' && (
          <Q title="How old is your child?" onBack={() => back('tutor_age')}>
            {[
              { id: 'elementary', label: '🎒 Elementary', desc: 'K–5th grade' },
              { id: 'middle', label: '📓 Middle School', desc: '6th–8th grade' },
              { id: 'high', label: '🎓 High School', desc: '9th–12th grade' },
            ].map(opt => <Opt key={opt.id} {...opt} selected={answers.tutor_age === opt.id} onClick={() => { save('tutor_age', opt.id); next('tutor_age') }} />)}
          </Q>
        )}

        {step === 'tutor_budget' && (
          <BudgetRange
            title="What's your hourly budget for tutoring?"
            unit="hr"
            options={['$15–30', '$30–50', '$50–80', '$80+']}
            selected={answers.tutor_budget}
            onSelect={val => { save('tutor_budget', val); next('tutor_budget') }}
            onBack={() => back('tutor_budget')}
          />
        )}

        {/* ===== ZIPCODE — 最后一步 ===== */}
        {step === 'zipcode' && (
          <div>
            <button
              onClick={() => {
                const lastStep = serviceQueue[serviceQueue.length - 1]
                setStep(lastStep)
              }}
              className="text-gray-400 text-sm mb-8 hover:text-gray-600"
            >← Back</button>
            <div className="text-center mb-8">
              <div className="text-4xl mb-3">📍</div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Where are you located?</h1>
              <p className="text-gray-400 text-sm">We'll find caregivers near you</p>
            </div>
            <div className="relative mb-3">
              <input
                type="text"
                inputMode="numeric"
                value={zipcode}
                onChange={e => handleZipcodeChange(e.target.value)}
                className={`w-full border-2 rounded-2xl px-4 py-4 text-lg text-center font-medium focus:outline-none tracking-widest ${
                  zipcodeError ? 'border-red-300' : zipcodeInfo ? 'border-green-400' : 'border-gray-200 focus:border-blue-400'
                }`}
                placeholder="ZIP Code"
                maxLength={5}
              />
              {zipcodeLoading && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {zipcodeInfo && (
              <div className="flex items-center justify-center gap-2 mb-6 text-green-600">
                <span className="text-lg">✓</span>
                <span className="font-semibold">{zipcodeInfo.city}, {zipcodeInfo.state}</span>
              </div>
            )}
            {zipcodeError && (
              <p className="text-center text-red-400 text-sm mb-6">{zipcodeError}</p>
            )}
            {!zipcodeInfo && !zipcodeError && zipcode.length < 5 && (
              <p className="text-center text-gray-400 text-sm mb-6">Enter your 5-digit ZIP code</p>
            )}

            <button
              onClick={goToRegister}
              disabled={!zipcodeInfo || zipcodeLoading}
              className="w-full bg-blue-600 text-white py-4 rounded-2xl font-semibold disabled:opacity-40 hover:bg-blue-700 transition"
            >
              Continue →
            </button>

          </div>
        )}

      </div>
    </div>
  )
}

// ---- 复用组件 ----
function Q({ title, children, onBack }: { title: string; children: React.ReactNode; onBack?: () => void }) {
  return (
    <div>
      {onBack && <button onClick={onBack} className="text-gray-400 text-sm mb-8 hover:text-gray-600">← Back</button>}
      <h1 className="text-2xl font-bold text-gray-900 mb-8">{title}</h1>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Opt({ label, desc, selected, onClick, multi }: {
  label: string; desc?: string; selected: boolean; onClick: () => void; multi?: boolean
}) {
  return (
    <button onClick={onClick}
      className={`w-full p-4 rounded-2xl border-2 text-left transition ${selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium text-gray-900">{label}</div>
          {desc && <div className="text-sm text-gray-400 mt-0.5">{desc}</div>}
        </div>
        {multi && (
          <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${selected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
            {selected && <div className="w-2 h-2 bg-white rounded-full" />}
          </div>
        )}
      </div>
    </button>
  )
}

function BudgetRange({ title, unit, options, selected, onSelect, onBack }: {
  title: string; unit: string; options: string[];
  selected: string; onSelect: (val: string) => void; onBack: () => void
}) {
  return (
    <div>
      <button onClick={onBack} className="text-gray-400 text-sm mb-8 hover:text-gray-600">← Back</button>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
      <p className="text-gray-400 text-sm mb-8">per {unit}</p>
      <div className="space-y-3">
        {options.map(opt => (
          <button key={opt} onClick={() => onSelect(opt)}
            className={`w-full p-4 rounded-2xl border-2 text-left font-medium transition ${selected === opt ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 hover:border-gray-300 text-gray-900'}`}>
            {opt}<span className="text-gray-400 font-normal text-sm ml-1">/ {unit}</span>
          </button>
        ))}
      </div>
    </div>
  )
}