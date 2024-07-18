import express from "express";
import { readSoloVote } from "../dao/solo_votes";
import { fetchProposeEvent } from "../../lib/events/event_helper_voting_contract";
import { getPoxInfo, VoteEvent, VotingEventProposeProposal } from "@mijoco/stx_helpers/dist/index";
import { getSummary } from "../../lib/events/proposal";
import { saveStackerBitcoinTxs, saveStackerStacksTxs } from "../../lib/stacker-votes/tally";
import { findProposalVotesByProposalAndSource, findVoteByProposalAndVoter } from "../dao/vote_count_helper";
import { findRewardSlotByAddress, findRewardSlotByAddressMinHeight, getRewardsByAddress, readAllRewardSlots, readRewardSlots } from "./reward_slots/reward_slot_helper";
import { getConfig } from "../../lib/config";

const router = express.Router();

router.get("/read-stacker-votes/:proposalContract", async (req, res, next) => {
  try {
    const proposal:VotingEventProposeProposal = await fetchProposeEvent(req.params.proposalContract)
    if (!proposal) {
      res.sendStatus(404);
    } else if (!proposal.stackerData || !proposal.stackerData.heights) {
      res.sendStatus(500);
    } else {
      console.log('/read-stacker-votes/:proposalContract: ' + proposal.proposal)
      await saveStackerBitcoinTxs(proposal)
      saveStackerStacksTxs(proposal)
      return res.send({message: 'all voting events being read into mongodb collection stackerVotes for contract ' + req.params.proposalContract});
    }
  } catch (error) {
    console.log('Error in routes: ', error)
    next('An error occurred fetching sbtc data.')
  }
});

router.get("/reconcile-stacker-votes/:proposal/:voter", async (req, res, next) => {
  try {
   // tbd
  } catch (error) {
    console.log('Error in routes: ', error)
    next('An error occurred fetching sbtc data.')
  }
});

router.get("/get-stacker-votes/:proposal", async (req, res, next) => {
  try {
    const votesBitcoin:Array<VoteEvent> = await findProposalVotesByProposalAndSource(req.params.proposal, 'bitcoin')
    const votesStacks:Array<VoteEvent> = await findProposalVotesByProposalAndSource(req.params.proposal, 'stacks')
    res.send({votesBitcoin, votesStacks})
  } catch (error) {
    console.log('Error in routes: ', error)
    next('An error occurred fetching sbtc data.')
  }
});

router.get("/sync/reward-slots", async (req, res, next) => {
  try {
    const response = await readAllRewardSlots();
    return res.send(response);
  } catch (error) {
    console.log('Error in routes: ', error)
    next('An error occurred fetching pox-info.')
  }
});


router.get("/results/solo-stackers/:address", async (req, res, next) => {
  try {
    const soloTx = await readSoloVote(req.params.address);
    return res.send(soloTx);
  } catch (error) {
    console.log('Error in routes: ', error)
    next('An error occurred fetching pox-info.')
  }
});

router.get("/results/summary/:proposal", async (req, res, next) => {
  try {
    const summary = await getSummary(req.params.proposal);
    return res.send(summary);
  } catch (error) {
    console.log('Error in routes: ', error)
    next('An error occurred fetching pox-info.')
  }
});

router.get("/reward-slot/:address/least-recent", async (req, res, next) => {
  try {
    const response = await findRewardSlotByAddressMinHeight(req.params.address);
    return res.send(response);
  } catch (error) {
    console.log('Error in routes: ', error)
    next('An error occurred fetching pox-info.')
  }
});

router.get("/reward-slot/:address", async (req, res, next) => {
  try {
    const response = await findRewardSlotByAddress(req.params.address);
    return res.send(response);
  } catch (error) {
    console.log('Error in routes: ', error)
    next('An error occurred fetching pox-info.')
  }
});

router.get("/sync/reward-slots/:offset/:limit", async (req, res, next) => {
  try {
    const poxInfo = await getPoxInfo(getConfig().stacksApi)
    const response = await readRewardSlots(Number(req.params.offset), Number(req.params.limit), poxInfo);
    return res.send(response);
  } catch (error) {
    console.error('Error in routes: ', error)
    next('An error occurred fetching sbtc data.') 
  }
});

router.get("/reward-slots/:address/:offset/:limit", async (req, res, next) => {
  try {
    const response = await getRewardsByAddress(Number(req.params.offset), Number(req.params.limit), req.params.address);
    return res.send(response);
  } catch (error) {
    console.error('Error in routes: ', error)
    next('An error occurred fetching sbtc data.') 
  }
});

router.get("/sync/reward-slots", async (req, res, next) => {
  try {
    const response = await readAllRewardSlots();
    return res.send(response);
  } catch (error) {
    console.log('Error in routes: ', error)
    next('An error occurred fetching pox-info.')
  }
});



export { router as stackerVotingRoutes }
