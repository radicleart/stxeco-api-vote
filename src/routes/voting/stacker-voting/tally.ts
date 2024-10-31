import {
  fetchAddressTransactions,
  getHashBytesFromAddress,
} from "@mijoco/btc_helpers/dist/index";
import {
  Delegation,
  getBalanceAtHeight,
  StackerInfo,
  type VoteEvent,
  type VotingEventProposeProposal,
} from "@mijoco/stx_helpers/dist/index";
import {
  getBurnHeightToRewardCycle,
  getCheckDelegation,
  getStackerInfoFromContract,
} from "@mijoco/stx_helpers/dist/pox/pox";
import { getConfig } from "../../../lib/config";
import {
  findStackerVotesByProposal,
  saveVote,
  updateVote,
} from "./vote_count_helper";
import {
  findPoxEntriesByAddressAndCycle,
  findPoxEntryByCycleAndIndex,
} from "../pox-entries/pox_helper";

const limit = 50;
const PRE_NAKAMOTO_STACKS_TIP_HEIGHT = 850850;
const stxPrecision = 1000000;

export async function reconcileVotes(
  proposal: VotingEventProposeProposal
): Promise<any> {
  const burnStartHeight =
    proposal.stackerData?.heights?.burnStart ||
    proposal.proposalData.burnStartHeight;
  const cycle1CV = proposal.stackerData
    ? await getBurnHeightToRewardCycle(
        getConfig().stacksApi,
        getConfig().poxContractId!,
        burnStartHeight + 200
      )
    : undefined;
  const cycle1 = Number(cycle1CV.cycle.value);

  const votes = await findStackerVotesByProposal(proposal.proposal);
  for (const vote of votes) {
    if (vote.source === "stacks") {
      try {
        await reconcileVoteViaStacks(proposal, vote);
      } catch (err: any) {
        console.error(
          "reconcileVotes: reconcileVoteViaStacks: error: " + err.message
        );
      }
    } else if (vote.source === "bitcoin") {
      try {
        await reconcileVoteViaBitcoin(proposal, cycle1, vote);
      } catch (err: any) {
        console.error(
          "reconcileVotes: reconcileVoteViaStacks: error: " + err.message
        );
      }
    } else {
      console.log("reconcileVotes: unknown source", vote);
    }
  }
  //if (voteEvent.source === 'bitcoin') {
  //   const result = await determineTotalAverageUstx(voteEvent.voter)
  //}
}

export async function reconcileVotesPerStacker(
  proposal: VotingEventProposeProposal,
  voter: string
): Promise<any> {}

export async function reconcileViaLocked(
  proposal: VotingEventProposeProposal,
  voter: string
) {
  let counter = 0;
  let balanceAtHeight = await getBalanceAtHeight(
    getConfig().stacksApi,
    voter,
    proposal.proposalData.startBlockHeight + 2200
  );
  //console.log('reconcileViaLocked: ------>' + balanceAtHeight.stx?.locked || 0)
  const locked1 = Number(balanceAtHeight.stx?.locked || 0);
  if (locked1 > 0) counter++;
  balanceAtHeight = await getBalanceAtHeight(
    getConfig().stacksApi,
    voter,
    proposal.proposalData.startBlockHeight + 200
  );
  const locked2 = Number(balanceAtHeight.stx?.locked || 0);
  //console.log('reconcileViaLocked: ------>' + balanceAtHeight.stx?.locked || 0)
  if (locked2 > 0) counter++;
  const locked = counter > 0 ? (locked1 + locked2) / counter : 0;
  //console.log(locked)
  return locked;
}
export async function reconcileViaBalanceAtHeight(
  proposal: VotingEventProposeProposal,
  voter: string
) {
  let counter = 0;
  let balanceAtHeight = await getBalanceAtHeight(
    getConfig().stacksApi,
    voter,
    proposal.proposalData.startBlockHeight
  );
  const locked = Number(balanceAtHeight.stx?.locked || 0);
  const unlocked = Number(balanceAtHeight.stx?.balance || 0) - locked;
  return { locked, unlocked, total: locked + unlocked };
}
export function fmtStxMicro(amountStx: number) {
  const formatted = parseFloat(amountStx.toFixed(6));
  // Multiply by 10^6 and convert to integer
  const integer = Math.round(formatted * 1000000);
  return integer;

  //return  (Math.round(amountStx) * stxPrecision *stxPrecision) / stxPrecision
}

export async function reconcileVoteViaStacks(
  proposal: VotingEventProposeProposal,
  vote: VoteEvent
) {
  //let locked = await reconcileViaLocked(proposal, vote.voter);
  const balanceObj = await reconcileViaBalanceAtHeight(proposal, vote.voter);
  let changes = {
    amount: balanceObj.total,
    amountUnlocked: balanceObj.unlocked,
    amountLocked: balanceObj.locked,
    event: "pool-vote",
  };
  /**
  let amountUstx = 0
  let stackerDel:Delegation = await getStackerInfoFromContract(getConfig().stacksApi,getConfig().poxContractId!, vote.voter, proposal.proposalData.startBlockHeight + 2200)
  let balanceAtHeight = await getBalanceAtHeight(getConfig().stacksApi, vote.voter, proposal.proposalData.startBlockHeight + 2200)
  if (stackerDel.amountUstx > 0) {
    amountUstx += stackerDel.amountUstx
    counter++
  }
  stackerDel = await getCheckDelegation(getConfig().stacksApi,getConfig().poxContractId!, vote.voter, proposal.proposalData.startBlockHeight + 200)
  if (stackerDel.amountUstx > 0) {
    amountUstx += stackerDel.amountUstx
    counter++
  }
  if (counter === 0) return

  console.log('reconcileVote: stacks stacker: vote: ' + vote.voter, stackerDel)
  changes.amount = amountUstx / counter
  if (stackerDel.delegatedTo) {
    changes.event = 'pool-vote'
    changes.delegateTo = stackerDel.delegatedTo
  } else {
    changes.event = 'solo-vote'
    changes.poxAddr = (stackerDel.poxAddr && stackerDel.poxAddr.version) ? stackerDel.poxAddr : undefined
  }
  */

  vote = (await updateVote(vote, changes)) as unknown as VoteEvent;
  console.log(
    "reconcileVote: updated stacks vote: amount: " +
      vote.amount +
      " voter: " +
      vote.voter
  );
}

export async function reconcileVoteViaBitcoin(
  proposal: VotingEventProposeProposal,
  cycle1: number,
  vote: VoteEvent
) {
  let counter = 0;
  let amountUstx = 0;
  let changes = {} as any;

  const totalUstxInCycle1 =
    (await getTotalStackedInCycle(vote.voter, cycle1)) || 0;
  const totalUstxInCycle2 =
    (await getTotalStackedInCycle(vote.voter, cycle1 + 1)) || 0;

  if (totalUstxInCycle1 > 0) {
    amountUstx += totalUstxInCycle1;
    counter++;
  }
  if (totalUstxInCycle2 > 0) {
    amountUstx += totalUstxInCycle2;
    counter++;
  }
  if (counter === 0) return;

  changes.amount = amountUstx / counter;
  changes.event = "solo-vote";

  vote = (await updateVote(vote, changes)) as unknown as VoteEvent;
  console.log(
    "reconcileVote: updated bitcoin vote: amount: " +
      vote.amount +
      " voter: " +
      vote.voter
  );
}

async function getTotalStackedInCycle(voter: string, cycle1: number) {
  const poxEntries: Array<any> = await findPoxEntriesByAddressAndCycle(
    voter,
    cycle1
  );
  let totalUstx = 0;
  const soloStackers = [];
  for (const entry of poxEntries) {
    if (entry.delegations === 0) {
      // not a pool operator
      totalUstx += entry.totalUstx;
      //soloStackers.push(entry)
    }
  }
  return totalUstx;
}

export async function saveStackerBitcoinTxs(
  proposal: VotingEventProposeProposal
): Promise<{
  bitcoinTxsYes: Array<VoteEvent>;
  bitcoinTxsNo: Array<VoteEvent>;
}> {
  const bitcoinTxsYes: Array<VoteEvent> = [];
  const bitcoinTxsNo: Array<VoteEvent> = [];
  if (!proposal.stackerData || !proposal.stackerData.heights)
    return { bitcoinTxsYes, bitcoinTxsNo };

  const allYesResults: Array<any> = await fetchAddressTransactions(
    getConfig().mempoolUrl,
    proposal.stackerData.bitcoinAddressYes
  );
  const allNoResults: Array<any> = await fetchAddressTransactions(
    getConfig().mempoolUrl,
    proposal.stackerData.bitcoinAddressNo
  );

  if (allYesResults) {
    for (const tx of allYesResults) {
      if (
        checkHeights(
          tx.status.block_height,
          proposal.stackerData.heights.burnStart,
          proposal.stackerData.heights.burnEnd
        )
      ) {
        bitcoinTxsYes.push(tx);
      } else {
        console.log("Out of bounds vote tx: " + tx.txid);
      }
    }
  }

  if (allNoResults) {
    for (const tx of allNoResults) {
      if (
        checkHeights(
          tx.status.block_height,
          proposal.stackerData.heights.burnStart,
          proposal.stackerData.heights.burnEnd
        )
      ) {
        bitcoinTxsNo.push(tx);
      } else {
        console.log("Out of bounds vote tx: " + tx.txid);
      }
    }
  }

  await convertBitcoinTxsToVotes(proposal, bitcoinTxsYes, true);
  await convertBitcoinTxsToVotes(proposal, bitcoinTxsNo, false);
  return { bitcoinTxsYes, bitcoinTxsNo };
}

export async function saveStackerStacksTxs(
  proposal: VotingEventProposeProposal
): Promise<{
  stackerTxsYes: Array<VoteEvent>;
  stackerTxsNo: Array<VoteEvent>;
}> {
  const stackerTxsYes: Array<VoteEvent> = [];
  const stackerTxsNo: Array<VoteEvent> = [];
  if (!proposal.stackerData || !proposal.stackerData.heights)
    return { stackerTxsYes, stackerTxsNo };
  let offset = 0; //await countContractEvents();
  let events: any;

  do {
    events = await getStacksTransactionsByAddress(
      offset,
      proposal.stackerData.stacksAddressYes
    );
    if (events && events.results.length > 0) {
      for (const tx of events.results) {
        if (
          checkHeights(
            tx.burn_block_height,
            proposal.stackerData.heights.burnStart,
            proposal.stackerData.heights.burnEnd
          )
        ) {
          stackerTxsYes.push(tx);
        } else {
          console.log("Out of bounds vote tx: " + tx.tx_id);
        }
      }
    }
    offset += limit;
  } while (events.results.length > 0);

  do {
    events = await getStacksTransactionsByAddress(
      offset,
      proposal.stackerData.stacksAddressNo
    );
    if (events && events.results.length > 0) {
      for (const tx of events.results) {
        if (
          checkHeights(
            tx.burn_block_height,
            proposal.stackerData.heights.burnStart,
            proposal.stackerData.heights.burnEnd
          )
        ) {
          stackerTxsNo.push(tx);
        } else {
          console.log("Out of bounds vote tx: " + tx.tx_id);
        }
      }
    }
    offset += limit;
  } while (events.results.length > 0);
  convertStacksTxsToVotes(proposal, stackerTxsYes, true);
  convertStacksTxsToVotes(proposal, stackerTxsNo, false);

  return { stackerTxsYes, stackerTxsNo };
}

function checkHeights(
  height: number,
  minBurnHeight: number,
  maxBurnHeight: number
): boolean {
  return height >= minBurnHeight && height < maxBurnHeight;
}

async function getStacksTransactionsByAddress(
  offset: number,
  principle: string
): Promise<any> {
  const url = `${
    getConfig().stacksApi
  }/extended/v1/address/${principle}/transactions?limit=${limit}&offset=${offset}`;
  let val;
  try {
    const response = await fetch(url);
    val = await response.json();
  } catch (err) {
    console.log("getPoolYesVotes: ", err);
  }
  return val;
}

async function convertStacksTxsToVotes(
  proposal: VotingEventProposeProposal,
  txs: Array<any>,
  vfor: boolean
): Promise<Array<VoteEvent>> {
  const votes: Array<VoteEvent> = [];
  console.log("addToMongoDB: transactions: " + vfor + " : " + txs.length);
  for (const v of txs) {
    //const stackerInfo = await getStackerInfoAtTip(proposal.proposalData.startBlockHeight, v.sender_address)
    //const stackerDel = await getCheckDelegationAtTip(proposal.proposalData.startBlockHeight, v.sender_address)
    //console.log('getCheckDelegationAtTip: ', stackerDel)

    const potVote: any = {
      //amount: (stackerDel && stackerDel.amount) ? stackerDel.amount : 0,
      amount: 0,
      for: vfor,
      proposalContractId: proposal.proposal,
      submitTxId: v.tx_id,
      event: "pool-or-solo-vote",
      source: "stacks",
      votingContractId: proposal.votingContract,
      voter: v.sender_address,
      blockHeight: v.block_height,
      burnBlockHeight: v.burn_block_height,
      reconciled: false,
    };
    try {
      await saveVote(potVote);
      console.log(
        "convertStacksTxsToVotes: saved vote from voter:" + potVote.voter
      );
      votes.push(potVote);
    } catch (err: any) {
      // duplicate bids from same bidder are counted as first bid
      console.log(
        "convertStacksTxsToVotes: ignored subsequent vote by:" + potVote.voter
      );
    }
  }
  return votes;
}

async function convertBitcoinTxsToVotes(
  proposal: VotingEventProposeProposal,
  txs: Array<any>,
  vfor: boolean
): Promise<Array<VoteEvent>> {
  const votes: Array<VoteEvent> = [];
  for (const v of txs) {
    try {
      const bitcoinAddress = v.vin[0].prevout.scriptpubkey_address;
      const alreadyCountedCheck = votes.findIndex(
        (o) => o.voter === bitcoinAddress
      );
      if (alreadyCountedCheck === -1) {
        const poxAddr = getHashBytesFromAddress(
          getConfig().network,
          bitcoinAddress
        );
        //const result = await determineTotalAverageUstx(bitcoinAddress)

        const potVote: any = {
          for: vfor,
          submitTxId: v.txid,
          event: "solo-vote",
          source: "bitcoin",
          proposalContractId: proposal.proposal,
          votingContractId: proposal.votingContract,
          poxAddr,
          voter: bitcoinAddress,
          burnBlockHeight: v.status.block_height,
          amount: 0, //result.total,
          reconciled: false,
          //amountNested: result.totalNested,
          //poxStacker: result.poxStacker
          //await getBurnBlockHeight(v.block_height),
        };
        try {
          await saveVote(potVote);
          console.log(
            "convertStacksTxsToVotes: saved vote from voter:" + potVote.voter
          );
          votes.push(potVote);
        } catch (err: any) {
          // duplicate bids from same bidder are counted as first bid
          console.log(
            "convertStacksTxsToVotes: ignored subsequent vote by:" +
              potVote.voter
          );
        }
        console.log(
          "convertBitcoinTxsToVotes: saved vote from voter:" + potVote.voter
        );
      }
    } catch (err: any) {
      console.log("addToMongoDB: solo vote: " + err.message);
    }
  }
  return votes;
}

async function determineTotalAverageUstx(bitcoinAddress: string) {
  const poxEntries1 = await extractAllPoxEntriesInCycle(bitcoinAddress, 78);
  const poxEntries2 = await extractAllPoxEntriesInCycle(bitcoinAddress, 79);

  let total = 0;
  let totalNested = 0;
  let poxStacker: string = "";
  let amount1 = 0;
  let amount2 = 0;
  let amountNested1 = 0;
  let amountNested2 = 0;

  if (poxEntries1) {
    for (const entry of poxEntries1) {
      if (entry.poxStackerInfo) {
        amount1 += entry.totalUstx;
        amountNested1 += entry.poxStackerInfo?.totalStacked || 0;
      } else {
        amount1 += entry.totalUstx;
      }
    }
  }
  if (poxEntries2) {
    for (const entry of poxEntries2) {
      if (entry.stacker) {
        amount2 += entry.totalUstx;
        amountNested2 += entry.poxStackerInfo?.totalStacked || 0;
      } else {
        amount2 += entry.totalUstx;
      }
    }
  }
  //total = Math.max(amount1, amount2)
  total = Math.floor((amount1 + amount2) / 2);
  totalNested = total + Math.floor((amountNested1 + amountNested2) / 2);
  //console.log('setSoloVotes: poxEntries: ' + total + ' for address: ' + bitcoinAddress)
  return { total, totalNested, poxStacker };
}
async function extractAllPoxEntriesInCycle(address: string, cycle: number) {
  const poxEntries: Array<any> = await findPoxEntriesByAddressAndCycle(
    address,
    cycle
  );
  let newEntries = [];
  try {
    for (const entry of poxEntries) {
      const idx = newEntries.findIndex((o) => o.index === entry.index);
      if (idx === -1) newEntries.push(entry);
    }
  } catch (err: any) {
    newEntries = poxEntries;
    console.error("extractAllPoxEntriesInCycle: error1: " + err.message);
  }

  for (const entry of newEntries) {
    try {
      if (entry.stacker) {
        const stackerInfoPerCycle = await getStackerInfoFromContract(
          getConfig().stacksApi,
          getConfig().network,
          getConfig().poxContractId!,
          entry.stacker,
          entry.cycle
        );
        if (stackerInfoPerCycle?.stacker?.rewardSetIndexes) {
          entry.poxStackerInfo = await countEntries(
            entry.cycle,
            stackerInfoPerCycle
          );
        }
      } else {
        entry.poxStackerInfo = [];
      }
    } catch (err: any) {
      console.error("extractAllPoxEntriesInCycle: error2: " + err.message);
    }
  }
  return newEntries;
}
async function countEntries(cycle: number, stackerInfo: StackerInfo) {
  let entries: Array<any> = [];
  let totalStacked = 0;
  if (
    !stackerInfo ||
    !stackerInfo.stacker ||
    !stackerInfo.stacker.rewardSetIndexes
  ) {
    return { entries, totalStacked };
  }

  for (const entry of stackerInfo.stacker.rewardSetIndexes) {
    try {
      const result = await findPoxEntryByCycleAndIndex(
        cycle,
        Number(entry.value)
      );
      //console.log('countEntries: poxEntry: ', result)
      if (result && result.length > 0) {
        entries.push({
          amount: result[0].totalUstx,
          cycle: result[0].cycle,
          index: result[0].index,
          bitcoinAddress: result[0].bitcoinAddr,
        });
        totalStacked += result[0].totalUstx;
      }
    } catch (err: any) {
      console.log("countEntries: " + err.message);
    }
  }
  return { entries, totalStacked };
}
