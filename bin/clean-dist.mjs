#!/usr/bin/env node
import { run } from './run-clean.mjs'

void run(['dist']).catch(err => {
  console.error(err)
  process.exit(1)
})
