import { ConfigDaoI } from "../types/local_types";
import process from 'process'

let CONFIG = {} as ConfigDaoI;

export function setConfigOnStart() {
  
  const network = process.env.NODE_ENV

  CONFIG.VITE_DOA = `${network}_${process.env.VITE_DOA}` || '';
  CONFIG.VITE_DOA_DEPLOYER = `${network}_${process.env.VITE_DOA_DEPLOYER}` || '';
  CONFIG.VITE_DOA_PROPOSAL = `${network}_${process.env.VITE_DOA_PROPOSAL}` || '';
  CONFIG.VITE_DOA_PROPOSALS = `${network}_${process.env.VITE_DOA_PROPOSALS}` || '';
  CONFIG.VITE_DOA_SNAPSHOT_VOTING_EXTENSION = `${network}_${process.env.VITE_DOA_SNAPSHOT_VOTING_EXTENSION}` || '';
  CONFIG.VITE_DOA_PROPOSAL_VOTING_EXTENSION = `${network}_${process.env.VITE_DOA_PROPOSAL_VOTING_EXTENSION}` || '';
  CONFIG.VITE_DOA_FUNDED_SUBMISSION_EXTENSION = `${network}_${process.env.VITE_DOA_FUNDED_SUBMISSION_EXTENSION}` || '';
  CONFIG.VITE_DOA_EMERGENCY_EXECUTE_EXTENSION = `${network}_${process.env.VITE_DOA_EMERGENCY_EXECUTE_EXTENSION}` || '';
  CONFIG.VITE_DOA_POX = `${network}_${process.env.VITE_DOA_POX}` || '';
  
}

export function getDaoConfig() {
	return CONFIG;
}
