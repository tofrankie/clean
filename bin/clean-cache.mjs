#!/usr/bin/env node
import { run } from './run-clean.mjs'

void run(['cache']).catch(err => {
  console.error(err)
  process.exit(1)
})
