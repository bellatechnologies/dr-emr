export type User = { username: string; email: string; name: string; role: string }
type Account = User & { totpSecret?: string }

export type Patient = {
  id: string
  name: string
  dob: string
  gender: string
  phone: string
  email: string
  address: string
}

// Fresh copies per createApp() call, so the integration check gets a clean directory each run.
export function seedUsers(): Account[] {
  return [
    { username: 'dr.sharma', email: 'sharma@hospital.com', name: 'Dr. Sharma', role: 'Doctor' },
    { username: 'nurse.priya', email: 'priya@hospital.com', name: 'Priya', role: 'Nurse' },
    { username: 'admin.raj', email: 'raj@hospital.com', name: 'Raj', role: 'Admin' },
  ]
}

export function seedPatients(): Patient[] {
  return [
    {
      id: 'P-10234',
      name: 'John Doe',
      dob: '1985-03-15',
      gender: 'Male',
      phone: '+91 98765 43210',
      email: 'john.doe@email.com',
      address: '12, MG Road, Bangalore',
    },
    {
      id: 'P-10235',
      name: 'Priya Kumari',
      dob: '1990-07-22',
      gender: 'Female',
      phone: '+91 87654 32109',
      email: 'priya.k@email.com',
      address: '45, Anna Nagar, Chennai',
    },
    {
      id: 'P-10236',
      name: 'Ravi Shankar',
      dob: '1978-12-01',
      gender: 'Male',
      phone: '+91 76543 21098',
      email: 'ravi.s@email.com',
      address: '78, Jubilee Hills, Hyderabad',
    },
  ]
}

export type { Account }
